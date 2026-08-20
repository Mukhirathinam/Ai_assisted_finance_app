from sqlalchemy.orm import Session
from sqlalchemy import func
import models
import datetime

class AccountingEngine:
    # 1. GENERATE CHRONOLOGICAL VOUCHER NUMBERS
    # Ensures vouchers are cataloged in correct order (e.g. JV/2026/001, JV/2026/002)
    @staticmethod
    def generate_voucher_no(db: Session, company_id: int):
        # Count current vouchers of this company to find the next index
        count = db.query(models.JournalVoucher).filter(models.JournalVoucher.company_id == company_id).count()
        year = datetime.date.today().year
        # Format index padded to 3 digits (e.g. 5 becomes "006")
        return f"JV/{year}/{count + 1:03d}"

    # 2. CALCULATE NET INCOME / NET LOSS
    # Summarizes total revenues and expenses to find the net profit.
    @staticmethod
    def get_profit_loss(db: Session, company_id: int = None):
        # Get ledger account summary
        tb = AccountingEngine.get_trial_balance(db, company_id=company_id)
        # Split income/revenue accounts and expense accounts
        income_accounts = [i for i in tb if i["category"] == "Revenue" or i["category"] == "Income"]
        expense_accounts = [i for i in tb if i["category"] == "Expenses" or i["category"] == "Expense"]
        
        # Calculate revenue credits and expense debits
        total_income = sum(i["credit"] - i["debit"] for i in income_accounts)
        total_expense = sum(i["debit"] - i["credit"] for i in expense_accounts)
        
        return {
            "income": income_accounts, "expenses": expense_accounts,
            "total_income": total_income, "total_expense": total_expense,
            "net_profit": total_income - total_expense # Bottom line net income
        }

    # 3. COMPILE TRIAL BALANCE
    # Joins Accounts and Entries tables to find the net debit/credit balance of all accounts.
    @staticmethod
    def get_trial_balance(db: Session, company_id: int = None):
        # Join Accounts with JournalEntries and aggregate sum of Debits & Credits
        query = db.query(
            models.Account.name, models.Account.code, models.Account.category,
            func.sum(models.JournalEntry.debit).label("total_debit"),
            func.sum(models.JournalEntry.credit).label("total_credit")
        ).outerjoin(models.JournalEntry, models.Account.id == models.JournalEntry.account_id)
        
        if company_id: query = query.filter(models.Account.company_id == company_id)
        results = query.group_by(models.Account.id).all()
        
        tb = []
        for row in results:
            td = row.total_debit or 0; tc = row.total_credit or 0
            # If account has any transaction history, compute net balance (Debit or Credit)
            if td > 0 or tc > 0:
                tb.append({
                    "account": row.name, 
                    "code": row.code, 
                    "category": row.category, 
                    "debit": max(0, td-tc),  # Net Debit balance
                    "credit": max(0, tc-td)  # Net Credit balance
                })
        return tb

    # 4. COMPILE ENTIRE DASHBOARD SUMMARY DATA
    # Fetches trial balance and P&L results to compute metrics for the main screen.
    @staticmethod
    def get_dashboard_summary(db: Session, company_id: int = None):
        pl = AccountingEngine.get_profit_loss(db, company_id=company_id)
        tb = AccountingEngine.get_trial_balance(db, company_id=company_id)
        
        # Group asset, liability, and equity accounts
        asset_accounts = [i for i in tb if i["category"] in ["Assets", "Asset"]]
        liability_accounts = [i for i in tb if i["category"] in ["Liabilities", "Liability"]]
        equity_accounts = [i for i in tb if i["category"] in ["Equity", "Owner's Equity", "Capital"]]
        
        # Calculate sum of Assets, Liabilities, and Equity
        total_assets = sum(i["debit"] - i["credit"] for i in asset_accounts)
        total_liabilities = sum(i["credit"] - i["debit"] for i in liability_accounts)
        total_equity = sum(i["credit"] - i["debit"] for i in equity_accounts)
        
        return {
            "total_assets": total_assets, "total_liabilities": total_liabilities, "total_equity": total_equity,
            "total_revenue": pl["total_income"], "total_expenses": pl["total_expense"],
            "net_profit": pl["net_profit"], "transaction_count": len(tb), "account_count": len(tb),
            "profit_loss": pl, "trial_balance": tb,
            "balance_sheet": {
                "assets": asset_accounts, 
                "liabilities": liability_accounts, 
                "equity": equity_accounts, 
                "totals": {
                    "assets": total_assets,
                    "equity": total_equity,
                    "liabilities": total_liabilities,
                    "equity_liabilities": total_equity + total_liabilities + pl["net_profit"] # Accounting equation validation
                }
            }
        }

    # 5. VALIDATE DOUBLE ENTRY BALANCING
    # Checks if total debits equal total credits.
    @staticmethod
    def validate_jv(entries):
        td = sum(e.debit for e in entries); tc = sum(e.credit for e in entries)
        # absolute check with a 0.01 margin to ignore tiny computer floating-point decimal rounding errors!
        if abs(td-tc) > 0.01: return False, "Unbalanced"
        return True, "Valid"
