from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

# 1. COMPANIES TABLE
# Stores companies/tenants in our multi-entity financial platform.
class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True) # Unique ID (e.g. 1, 2)
    name = Column(String, unique=True, index=True)      # e.g., "Acme Corporation"
    industry = Column(String, nullable=True)           # e.g., "Technology"
    currency = Column(String, default="INR")           # e.g., "INR" or "USD"
    
    # Python relationships to link other tables to this company
    accounts = relationship("Account", back_populates="company")
    vouchers = relationship("JournalVoucher", back_populates="company")
    users = relationship("User", back_populates="company")

# 2. USERS TABLE
# Stores login credentials and associates each user with a specific company.
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True) # Unique user ID
    username = Column(String, unique=True, index=True) # User's login name (must be unique)
    password_hash = Column(String)                     # Secure encrypted password representation
    company_id = Column(Integer, ForeignKey("companies.id")) # Link pointing to the user's company
    
    # Python relationship to fetch the company object directly (e.g. user.company.name)
    company = relationship("Company", back_populates="users")

# 3. ACCOUNTS TABLE
# Stores the Chart of Accounts (Asset, Liability, Revenue, Expenses) for each company.
class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True, index=True) # Unique account ID
    company_id = Column(Integer, ForeignKey("companies.id")) # Link to the owning company
    name = Column(String, index=True)                  # e.g., "Bank" or "Office Rent"
    code = Column(String, index=True)                  # e.g., "1001" or "5001"
    category = Column(String)                          # "Assets", "Liabilities", "Revenue", "Expenses"
    
    # Python relationships to link to company and journal transaction lines
    company = relationship("Company", back_populates="accounts")
    entries = relationship("JournalEntry", back_populates="account")

# 4. JOURNAL VOUCHERS TABLE
# Acts as the parent invoice/receipt envelope for a business transaction.
class JournalVoucher(Base):
    __tablename__ = "journal_vouchers"
    id = Column(Integer, primary_key=True, index=True) # Unique transaction ID
    voucher_no = Column(String, index=True)            # Unique chronological serial (e.g. JV/2026/001)
    company_id = Column(Integer, ForeignKey("companies.id")) # Link to the company
    date = Column(DateTime, default=datetime.datetime.utcnow) # Transaction date
    description = Column(String)                       # e.g., "Paid office utilities"
    reference = Column(String, nullable=True)          # e.g., Invoice # invoice-9092
    department = Column(String, nullable=True)         # Cost center (e.g., "Marketing")
    prepared_by = Column(String, nullable=True)        # Name of employee who entered it
    approved_by = Column(String, nullable=True)        # Name of manager who approved it
    
    # Python relationships
    company = relationship("Company", back_populates="vouchers")
    # cascade="all, delete-orphan" means: if this voucher is deleted, delete all its debit/credit lines too!
    entries = relationship("JournalEntry", back_populates="voucher", cascade="all, delete-orphan")

# 5. JOURNAL ENTRIES TABLE
# Stores the individual debit/credit lines inside a Journal Voucher (Double-Entry lines).
class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id = Column(Integer, primary_key=True, index=True) # Unique transaction line ID
    voucher_id = Column(Integer, ForeignKey("journal_vouchers.id")) # Parent voucher link
    account_id = Column(Integer, ForeignKey("accounts.id"))         # Target ledger account link
    debit = Column(Float, default=0.0)                              # Debit amount (money in/assets increase)
    credit = Column(Float, default=0.0)                             # Credit amount (money out/liabilities increase)
    
    # Python relationships
    voucher = relationship("JournalVoucher", back_populates="entries")
    account = relationship("Account", back_populates="entries")
