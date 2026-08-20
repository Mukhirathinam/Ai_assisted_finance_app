from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# ========================================================
# 1. JOURNAL ENTRY SCHEMAS
# ========================================================

# The standard base data structure for a debit/credit line
class JournalEntryBase(BaseModel):
    account_id: int
    debit: float = 0.0
    credit: float = 0.0

# Used when receiving entries to create a transaction (matches incoming UI form lines)
class JournalEntryCreate(JournalEntryBase):
    pass

# Used when returning entries to the UI (includes database ID and resolved account name)
class JournalEntry(JournalEntryBase):
    id: int
    account_name: Optional[str] = None
    class Config: 
        from_attributes = True # Enables Pydantic to read database object properties directly

# ========================================================
# 2. JOURNAL VOUCHER (JV) SCHEMAS
# ========================================================

# The standard base blueprint for a transaction receipt
class JournalVoucherBase(BaseModel):
    description: str
    date: Optional[datetime] = None
    company_id: int = 1
    voucher_no: Optional[str] = None
    reference: Optional[str] = None
    department: Optional[str] = None
    prepared_by: Optional[str] = None
    approved_by: Optional[str] = None

# Used when users submit the "Post Transaction" form in the UI. Requires entries list.
class JournalVoucherCreate(JournalVoucherBase):
    entries: List[JournalEntryCreate]

# Used to display saved transactions on the UI ledger logs list (contains IDs and generated values)
class JournalVoucher(JournalVoucherBase):
    id: int
    entries: List[JournalEntry]
    class Config: 
        from_attributes = True

# ========================================================
# 3. COMPANY SCHEMAS
# ========================================================

# Used to represent and switch between companies on the UI dropdown switcher
class Company(BaseModel):
    id: int
    name: str
    industry: Optional[str] = None
    currency: str = "INR"
    class Config: 
        from_attributes = True

# ========================================================
# 4. USER & AUTHENTICATION SCHEMAS
# ========================================================

# Matches fields on the "Sign Up / Registration" input form
class UserCreate(BaseModel):
    username: str
    password: str
    company_name: str

# Matches fields on the "Sign In / Login" input form
class UserLogin(BaseModel):
    username: str
    password: str
    company_name: str

# Used to return current session user information to UI (does NOT leak passwords!)
class User(BaseModel):
    id: int
    username: str
    company_id: int
    class Config: 
        from_attributes = True

# ========================================================
# 5. ACCOUNT SCHEMAS
# ========================================================

# Used when creating a new category in the Chart of Accounts
class AccountCreate(BaseModel):
    name: str
    code: str
    category: str
    company_id: int

# Used to display existing categories in lists and select dropdowns in the UI
class Account(BaseModel):
    id: int
    name: str
    code: str
    category: str
    company_id: int
    class Config: 
        from_attributes = True
