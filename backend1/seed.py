import models, database
import bcrypt

# Populates the database with initial standard mock data for users, companies, accounts, and journal vouchers.
def seed_data():
    # 1. Open a temporary database session connection
    db = database.SessionLocal()
    try:
        # ========================================================
        # A. SEED SAMPLE TEST COMPANIES
        # ========================================================
        
        # Company 1: Acme Corporation
        company1 = db.query(models.Company).filter(models.Company.id == 1).first()
        if not company1:
            company1 = models.Company(id=1, name="Acme Corporation", industry="Technology", currency="INR")
            db.add(company1)
            
        # Company 2: Globex Corporation
        company2 = db.query(models.Company).filter(models.Company.id == 2).first()
        if not company2:
            company2 = models.Company(id=2, name="Globex Corporation", industry="Manufacturing", currency="INR")
            db.add(company2)
            
        # Company 3: Stark Industries
        company3 = db.query(models.Company).filter(models.Company.id == 3).first()
        if not company3:
            company3 = models.Company(id=3, name="Stark Industries", industry="Defense", currency="INR")
            db.add(company3)

        # Company 4: Wayne Enterprises
        company4 = db.query(models.Company).filter(models.Company.id == 4).first()
        if not company4:
            company4 = models.Company(id=4, name="Wayne Enterprises", industry="Finance", currency="INR")
            db.add(company4)

        # Company 5: Cyberdyne Systems
        company5 = db.query(models.Company).filter(models.Company.id == 5).first()
        if not company5:
            company5 = models.Company(id=5, name="Cyberdyne Systems", industry="Robotics", currency="USD")
            db.add(company5)
            
        # Save companies to database so their IDs are verified and loaded
        db.commit()
        
        # ========================================================
        # B. SEED THE STANDARD CHART OF ACCOUNTS FOR EACH COMPANY
        # ========================================================
        for company_id in range(1, 6):
            # If the company doesn't have any accounts set up yet, seed their ledger structures:
            if db.query(models.Account).filter(models.Account.company_id == company_id).count() == 0:
                standard_accounts = [
                    models.Account(company_id=company_id, name="Bank", code="1001", category="Assets"),
                    models.Account(company_id=company_id, name="Cash", code="1002", category="Assets"),
                    models.Account(company_id=company_id, name="Accounts Receivable", code="1003", category="Assets"),
                    models.Account(company_id=company_id, name="Accounts Payable", code="2001", category="Liabilities"),
                    models.Account(company_id=company_id, name="Sales Revenue", code="4001", category="Revenue"),
                    models.Account(company_id=company_id, name="General Expenses", code="5001", category="Expenses"),
                ]
                db.add_all(standard_accounts)
            
        # ========================================================
        # C. SEED DEFAULT ADMINISTRATOR ACCOUNT
        # ========================================================
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if not admin:
            # Scramble/encrypt password "admin123" securely using bcrypt salt hashing
            hashed = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            # Create user linked to Acme Corporation (Company ID = 1)
            admin = models.User(username="admin", password_hash=hashed, company_id=1)
            db.add(admin)

        # Commit final changes permanently
        db.commit()
    finally:
        # Close connection session cleanly
        db.close()
