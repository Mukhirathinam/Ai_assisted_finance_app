from google import genai

class AIService:
    # 1. INITIALIZE GEMINI CLIENT
    # Authenticates and connects to the official Google Gemini API servers.
    def __init__(self, api_key: str):
        if api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    # 2. DETERMINISTIC TRANSACTION SPREADSHEET MAPPER (DIRECT PARSER)
    # Reads rows parsed from an uploaded CSV spreadsheet and returns balanced journal entries deterministically.
    def direct_file_parse(self, extracted_data: list, account_list: list):
        # Find default bank/cash/suspense account names
        bank_name = "Bank"
        suspense_name = "Suspense"
        
        # Verify if they are in the account list (case insensitive search)
        for a in account_list:
            if a["name"].lower() == "bank":
                bank_name = a["name"]
            elif a["name"].lower() == "suspense":
                suspense_name = a["name"]
                
        # Group rows by (Date, Description) to combine debit/credit legs of the same transaction
        groups = {}
        for row in extracted_data:
            date = str(row.get("Date", "2026-05-01")).strip()
            desc = str(row.get("Description", "Imported Voucher (Direct)")).strip()
            key = (date, desc)
            
            if key not in groups:
                groups[key] = {
                    "reference": str(row.get("Reference", "")).strip(),
                    "department": str(row.get("Department", "")).strip(),
                    "rows": []
                }
            groups[key]["rows"].append(row)
            
        parsed_vouchers = []
        for (date, desc), group_data in groups.items():
            entries = []
            for row in group_data["rows"]:
                amount = float(row.get("Amount", 0))
                is_debit = str(row.get("Type", "")).strip().lower() == "debit"
                acc_name_or_code = str(row.get("Account", "")).strip()
                
                # Match account by code or name
                target_account_name = None
                for a in account_list:
                    if a["name"].lower() == acc_name_or_code.lower() or a.get("code", "") == acc_name_or_code:
                        target_account_name = a["name"]
                        break
                
                if not target_account_name:
                    # Keep original CSV name so the UI can dynamically auto-create it if missing
                    target_account_name = acc_name_or_code
                
                entries.append({
                    "account_name": target_account_name,
                    "debit": amount if is_debit else 0.0,
                    "credit": amount if not is_debit else 0.0
                })
            
            # Check if this voucher balances (sum of Debits == sum of Credits)
            total_debit = sum(e["debit"] for e in entries)
            total_credit = sum(e["credit"] for e in entries)
            diff = total_debit - total_credit
            
            # If it is unbalanced, add a balancing offset entry (to Bank or Suspense)
            if abs(diff) > 0.01:
                has_bank = any(e["account_name"].lower() == bank_name.lower() for e in entries)
                offset_account_name = suspense_name if has_bank else bank_name
                
                if diff > 0:  # Debits exceed Credits, add Credit offset
                    entries.append({
                        "account_name": offset_account_name,
                        "debit": 0.0,
                        "credit": abs(diff)
                    })
                else:  # Credits exceed Debits, add Debit offset
                    entries.append({
                        "account_name": offset_account_name,
                        "debit": abs(diff),
                        "credit": 0.0
                    })
            
            parsed_vouchers.append({
                "description": desc,
                "date": date,
                "reference": group_data["reference"],
                "department": group_data["department"],
                "prepared_by": "System Direct Parser",
                "approved_by": "",
                "entries": entries
            })
            
        return parsed_vouchers

    # 3. AI-POWERED TRANSACTION SPREADSHEET MAPPER (SEMANTIC PARSER)
    # Sends transactions and the chart of accounts to Gemini for intelligent category matching.
    async def ai_file_parse(self, extracted_data: list, account_list: list):
        if not self.client:
            # Fallback to direct parsing if API client isn't configured
            return self.direct_file_parse(extracted_data, account_list)
        
        # Prepare list of accounts
        accounts_str = "\n".join([f"- Name: {a['name']}, Category: {a['category']}" for a in account_list])
        
        # Prepare list of transaction rows
        tx_str = "\n".join([f"- Row {i}: {tx}" for i, tx in enumerate(extracted_data)])
        
        prompt = f"""
You are an expert accountant. You are given a list of bank statement transactions and a Chart of Accounts.
Your task is to analyze each transaction row and map it to a balanced double-entry Journal Voucher draft.

Available Chart of Accounts (use these names if they match):
{accounts_str}

Transactions to map:
{tx_str}

For each transaction row:
1. Examine the description and account type.
2. Choose or suggest the most appropriate account name. You can use names from the Chart of Accounts list, or suggest a new relevant account name (e.g. "Software Subscription Expense" if the transaction is for Slack/AWS but no matching account exists).
3. Generate a balanced double-entry transaction. Debits must equal Credits.
   - Typically, one entry is the mapped account (e.g. Sales Revenue or General Expenses).
   - The other entry is the offsetting account (usually Cash, Bank, or Suspense) depending on the type.
4. Output a JSON array containing vouchers. Each voucher must follow this exact structure:
[
  {{
    "description": "Short description of transaction",
    "date": "YYYY-MM-DD",
    "reference": "reference code or empty string",
    "department": "department name or empty string",
    "prepared_by": "System AI",
    "approved_by": "",
    "entries": [
      {{
        "account_name": "Mapped Account Name",
        "debit": float,
        "credit": float
      }},
      {{
        "account_name": "Offsetting Account Name (e.g. Bank)",
        "debit": float,
        "credit": float
      }}
    ]
  }}
]

Return ONLY the raw JSON array. Do not include markdown code block syntax (no ```json).
"""
        try:
            from google.genai import types
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            import json
            parsed = json.loads(response.text)
            return parsed
        except Exception as e:
            print(f"AI parsing failed: {e}. Falling back to direct parsing.")
            return self.direct_file_parse(extracted_data, account_list)

    # 3. INTERACTIVE CONVERSATIONAL CO-PILOT
    # Sends user questions to the Gemini 1.5 Flash model and returns a summary answer.
    async def answer_query(self, text: str, db, company_id: int):
        import models
        from accounting_engine import AccountingEngine
        # Fetch the company name to personalize/ground the AI response
        company = db.query(models.Company).filter(models.Company.id == company_id).first()
        company_name = company.name if company else "your company"
        
        # Fetch actual real-time financial summary data of the company
        try:
            summary = AccountingEngine.get_dashboard_summary(db, company_id=company_id)
            financial_context = f"""
You are given the following real-time financial stats for {company_name}:
- Total Assets: INR {summary['total_assets']:,.2f}
- Total Liabilities: INR {summary['total_liabilities']:,.2f}
- Total Equity: INR {summary['total_equity']:,.2f}
- Total Revenue: INR {summary['total_revenue']:,.2f}
- Total Expenses: INR {summary['total_expenses']:,.2f}
- Net Profit: INR {summary['net_profit']:,.2f}

Account Trial Balance List:
"""
            for item in summary.get('trial_balance', []):
                financial_context += f"- {item['account']} (Category: {item['category']}, Code: {item['code']}): Debit INR {item['debit']:,.2f}, Credit INR {item['credit']:,.2f}\n"
        except Exception as ex:
            financial_context = "No financial data loaded or error retrieving records."
            print("AI context error:", ex)
        
        if self.client:
            try:
                prompt = f"""
You are a helpful AI financial assistant for the company {company_name}.
Use the following real-time financial records to answer the user's question accurately.
If the information is not present in the data or if the user asks a general question, answer as best as you can.

Financial Context:
{financial_context}

User's Question: {text}
Answer accurately and concisely based on the context above. Use Rupees (INR/₹) for any currency display.
"""
                # Ask Gemini using system prompt instructions with grounded context
                response = self.client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt
                )
                return response.text
            except Exception as e:
                import traceback
                traceback.print_exc()
                return f"AI Error: {str(e)}"
        return "AI not configured properly. Missing GEMINI_API_KEY."
