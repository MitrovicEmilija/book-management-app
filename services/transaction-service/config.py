import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
    MYSQL_USER = os.getenv('MYSQL_USER', 'springstudent')
    MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', 'springstudent')
    MYSQL_DB = os.getenv('MYSQL_DB', 'Transactions')