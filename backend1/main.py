from fastapi import FastAPI, Depends, HTTPException, Body, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn
import os
import pandas as pd
import numpy as np
import io
from dotenv import load_dotenv
import bcrypt

# 1. Load configuration keys from the hidden .env file (e.g. GEMINI_API_KEY)
load_dotenv()

import models, schemas, database
from accounting_engine import AccountingEngine
from ai_service import AIService
from typing import List
from seed import seed_data

# 2. Automatically build the physical SQL database tables if they do not exist
models.Base.metadata.create_all(bind=database.engine)
# 3. Seed default mock companies, standard account profiles, and default admin user credentials
seed_data()

# 4. Initialize the FastAPI web server instance
app = FastAPI(title="Enterprise Financial Management System")

# 5. Add CORS middleware so the frontend browser page is allowed to communicate with this backend API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 6. Initialize the conversational AI service using the API key loaded from the environment
ai_service = AIService(api_key=os.getenv("GEMINI_API_KEY"))

# ========================================================
# SYSTEM ROUTES
# ========================================================

# Base root status check route to confirm the API is online
@app.get("/")
async def root():
    return {"message": "Enterprise Financial Management System API"}

# ========================================================
# COMPANY LOGIC ROUTES
# ========================================================

# Fetch list of all registered companies (used in navigation bar dropdowns)
@app.get("/companies/", response_model=List[schemas.Company])
def read_companies(db: Session = Depends(database.get_db)):
    return db.query(models.Company).all()

# Retrieve calculated dashboard summary metrics for a specific company (Asset, Liability, Equity, Profit stats)
@app.get("/companies/{company_id}/summary")
def get_company_summary(company_id: int, db: Session = Depends(database.get_db)):
    return AccountingEngine.get_dashboard_summary(db, company_id)

# ========================================================
# USER AUTHENTICATION ROUTES
# ========================================================

# Registers a new user. If the input company does not exist, it creates the company and seeds default accounts.
@app.post("/register/", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # Verify username is unique and not already taken
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Handle dynamic company creation if it is a new entity
    company = db.query(models.Company).filter(models.Company.name == user.company_name).first()
    if not company:
        # Create new company entry
        company = models.Company(name=user.company_name, industry="General", currency="USD")
        db.add(company)
        db.commit()
        db.refresh(company)
        
        # Seed standard chart of accounts for the new company so it is ready to use immediately
        default_accounts = [
            models.Account(company_id=company.id, name="Bank", code="1001", category="Assets"),
            models.Account(company_id=company.id, name="Cash", code="1002", category="Assets"),
            models.Account(company_id=company.id, name="Accounts Receivable", code="1003", category="Assets"),
            models.Account(company_id=company.id, name="Accounts Payable", code="2001", category="Liabilities"),
            models.Account(company_id=company.id, name="Sales Revenue", code="4001", category="Revenue"),
            models.Account(company_id=company.id, name="General Expenses", code="5001", category="Expenses"),
        ]
        db.add_all(default_accounts)
        db.commit()

    # Hash user password securely using bcrypt encryption
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    new_user = models.User(username=user.username, password_hash=hashed_password, company_id=company.id)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# Authenticates user login credentials against secure database password hash
@app.post("/login/", response_model=schemas.User)
def login(user: schemas.UserLogin, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if not db_user or not bcrypt.checkpw(user.password.encode('utf-8'), db_user.password_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    # Check if user belongs to the requested company
    company = db.query(models.Company).filter(models.Company.id == db_user.company_id).first()
    if not company or company.name != user.company_name:
        raise HTTPException(status_code=401, detail=f"User {user.username} does not belong to '{user.company_name}'")
        
    return db_user

# ========================================================
# BOOKKEEPING TRANSACTION ROUTES
# ========================================================

# Creates a balanced Journal Voucher transaction with nested entry lines
@app.post("/jv/", response_model=schemas.JournalVoucher)
def create_jv(jv: schemas.JournalVoucherCreate, db: Session = Depends(database.get_db)):
    # Validate double entry balancing rules (Debits must equal Credits)
    is_valid, msg = AccountingEngine.validate_jv(jv.entries)
    if not is_valid: raise HTTPException(status_code=400, detail=msg)
    
    # Assign consecutive voucher sequence number
    v_no = AccountingEngine.generate_voucher_no(db, jv.company_id)
    
    # Save parent Journal Voucher envelope
    db_jv = models.JournalVoucher(**jv.dict(exclude={'entries', 'voucher_no'}), voucher_no=v_no)
    db.add(db_jv)
    db.commit()
    db.refresh(db_jv)
    
    # Save individual entry lines (debits & credits) linked to the parent voucher ID
    for entry in jv.entries:
        db_entry = models.JournalEntry(**entry.dict(), voucher_id=db_jv.id)
        db.add(db_entry)
    db.commit()
    return db_jv

# Retrieves all transactions logged under a company
@app.get("/jv/", response_model=List[schemas.JournalVoucher])
def read_jvs(company_id: int = 1, db: Session = Depends(database.get_db)):
    return db.query(models.JournalVoucher).filter(models.JournalVoucher.company_id == company_id).all()

# Deletes a transaction and all its child entry lines from database logs
@app.delete("/jv/{jv_id}")
def delete_jv(jv_id: int, db: Session = Depends(database.get_db)):
    jv = db.query(models.JournalVoucher).filter(models.JournalVoucher.id == jv_id).first()
    if not jv:
        raise HTTPException(status_code=404, detail="Journal Voucher not found")
    db.delete(jv) # Wipes parent and automatically cascades delete to nested entry rows
    db.commit()
    return {"message": "Deleted successfully"}

# ========================================================
# CHART OF ACCOUNTS ROUTES
# ========================================================

# Get all ledger accounts categories (Bank, Cash, Revenue) for a company
@app.get("/accounts/", response_model=List[schemas.Account])
def read_accounts(company_id: int = 1, db: Session = Depends(database.get_db)):
    return db.query(models.Account).filter(models.Account.company_id == company_id).all()

# Creates a new ledger account category
@app.post("/accounts/", response_model=schemas.Account)
def create_account(account: schemas.AccountCreate, db: Session = Depends(database.get_db)):
    db_acc = models.Account(
        name=account.name,
        code=account.code,
        category=account.category,
        company_id=account.company_id
    )
    db.add(db_acc)
    db.commit()
    db.refresh(db_acc)
    return db_acc

# Safely deletes a ledger account. Blocks request if account is already referenced in transactions.
@app.delete("/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(database.get_db)):
    # Safeguard check: search if account exists in posted journal entries
    used = db.query(models.JournalEntry).filter(models.JournalEntry.account_id == account_id).first()
    if used:
        raise HTTPException(status_code=400, detail="Cannot delete: Account is in use by a Journal Voucher.")
    
    acc = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
        
    db.delete(acc)
    db.commit()
    return {"status": "deleted"}

# Retrieves calculations for main landing view (duplicated endpoint mapping for frontend router safety)
@app.get("/companies/{company_id}/summary")
def get_summary(company_id: int, db: Session = Depends(database.get_db)):
    return AccountingEngine.get_dashboard_summary(db, company_id=company_id)

# ========================================================
# AI OPERATIONS & CSV BATCH INTEGRATIONS
# ========================================================

# Parses uploaded transaction statement spreadsheet files, runs validations, and returns double-entry matches
@app.post("/ai/upload-jv/")
async def upload_jv(
    file: UploadFile = File(...), 
    company_id: int = 1, 
    use_ai: bool = False,
    db: Session = Depends(database.get_db)
):
    # Verify file is a CSV
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .csv file.")
        
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing CSV: {str(e)}")
        
    # Structural Validation: Ensure all required columns exist
    required_columns = ["Date", "Description", "Account", "Amount", "Type"]
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing_cols)}")
        
    # Use pandas & numpy to verify the 'Amount' column strictly contains numbers (no letters or empty entries)
    df['Amount'] = pd.to_numeric(df['Amount'], errors='coerce')
    amounts_array = df['Amount'].to_numpy()
    
    if np.isnan(amounts_array).any():
        raise HTTPException(status_code=400, detail="Validation Failed: 'Amount' column contains invalid, missing, or non-numeric values.")
        
    # Convert sheet rows to python list of dicts and feed them to either direct parser or AI parser
    extracted_data = df.to_dict(orient="records")
    accounts = db.query(models.Account).filter(models.Account.company_id == company_id).all()
    account_list = [{"name": a.name, "id": a.id, "category": a.category, "code": a.code} for a in accounts]
    
    if use_ai:
        return await ai_service.ai_file_parse(extracted_data, account_list)
    else:
        return ai_service.direct_file_parse(extracted_data, account_list)

# Processes natural language queries, sending instructions to Google Gemini co-pilot
@app.post("/ai/query/")
async def query_ai(text: str = Body(..., embed=True), company_id: int = 1, db: Session = Depends(database.get_db)):
    answer = await ai_service.answer_query(text, db, company_id=company_id)
    return {"answer": answer}

# Placeholder for excel financial report generation download links
@app.get("/reports/export-excel")
def export_reports(company_id: int, db: Session = Depends(database.get_db)):
    # Simple redirect to accounting engine export
    pass 

# Run Web server on port 8000
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
