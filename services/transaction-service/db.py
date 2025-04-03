import mysql.connector
from config import Config
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('transactions.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        self.conn = mysql.connector.connect(
            host=Config.MYSQL_HOST,
            user=Config.MYSQL_USER,
            password=Config.MYSQL_PASSWORD,
            database=Config.MYSQL_DB
        )
        self.cursor = self.conn.cursor(dictionary=True)
        logger.info('Successfully connected to the database')

    def insert(self, query, params):
        self.cursor.execute(query, params)
        self.conn.commit()
        return self.cursor.lastrowid

    def select(self, query, params=None):
        if params:
            self.cursor.execute(query, params)
        else:
            self.cursor.execute(query)
        return self.cursor.fetchall()

    def select_one(self, query, params):
        self.cursor.execute(query, params)
        return self.cursor.fetchone()

    def update(self, query, params):
        self.cursor.execute(query, params)
        self.conn.commit()
        return self.cursor.rowcount

    def delete(self, query, params):
        self.cursor.execute(query, params)
        self.conn.commit()
        return self.cursor.rowcount

    def close(self):
        self.cursor.close()
        self.conn.close()
        logger.info('Database connection closed')

# Factory function to create a database instance
def get_db_connection():
    return Database()