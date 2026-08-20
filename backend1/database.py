from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Find the absolute folder path of this python file on your computer
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Define the file path where the SQLite database file "accounting.db" will be stored
DATABASE_PATH = os.path.join(BASE_DIR, "accounting.db")

# Format the database connection URL that SQLAlchemy expects (e.g. "sqlite:///C:/path/to/accounting.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Create the database engine. check_same_thread=False allows multiple web requests to use the database at the same time.
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

# Create a session factory. When called, it gives us a temporary connection to the database to read/write records.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# The base class that all of our database models (companies, users, accounts, etc.) will inherit from
Base = declarative_base()

# A generator function (Dependency) that yields a database session for a web request and automatically closes it when done.
def get_db():
    db = SessionLocal() # Open connection
    try: 
        yield db        # Hand connection over to the API route to use
    finally: 
        db.close()      # Close connection immediately after request finishes to prevent memory leaks
