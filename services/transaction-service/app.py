import mysql.connector
import logging
from flask import Flask, request, jsonify
from config import Config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('transactions.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

def get_db_connection():
    return mysql.connector.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DB
    )

# Create a transaction
@app.route('/transactions', methods=['POST'])
def create_transaction():
    logger.info('Received POST request to create a transaction')
    try:
        data = request.get_json()
        user_id = data.get('userId')
        book_id = data.get('bookId')
        transaction_type = data.get('transactionType')

        if not all([user_id, book_id, transaction_type]):
            logger.warning('Missing required fields in request')
            return jsonify({'error': 'userId, bookId, and transactionType are required'}), 400

        if transaction_type not in ['BORROW', 'PURCHASE']:
            logger.warning(f'Invalid transactionType: {transaction_type}')
            return jsonify({'error': 'transactionType must be BORROW or PURCHASE'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            INSERT INTO transactions (user_id, book_id, transaction_type)
            VALUES (%s, %s, %s)
        """
        cursor.execute(query, (user_id, book_id, transaction_type))
        conn.commit()

        transaction_id = cursor.lastrowid
        logger.info(f'Transaction created with ID: {transaction_id}')
        cursor.close()
        conn.close()

        return jsonify({
            'id': transaction_id,
            'userId': user_id,
            'bookId': book_id,
            'transactionType': transaction_type,
            'message': 'Transaction created'
        }), 201

    except mysql.connector.Error as err:
        logger.error(f'Database error while creating transaction: {str(err)}')
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        logger.error(f'Server error while creating transaction: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get all transactions
@app.route('/transactions', methods=['GET'])
def get_all_transactions():
    logger.info('Received GET request to fetch all transactions')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM transactions')
        transactions = cursor.fetchall()
        logger.info(f'Fetched {len(transactions)} transactions')
        cursor.close()
        conn.close()

        # Map user_id to userId and book_id to bookId
        for transaction in transactions:
            transaction['userId'] = transaction.pop('user_id')
            transaction['bookId'] = transaction.pop('book_id')
            transaction['transactionType'] = transaction.pop('transaction_type')
            transaction['transactionDate'] = transaction.pop('transaction_date').isoformat()

        return jsonify(transactions), 200

    except mysql.connector.Error as err:
        logger.error(f'Database error while fetching transactions: {str(err)}')
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        logger.error(f'Server error while fetching transactions: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get transaction by id
@app.route('/transactions/<int:id>', methods=['GET'])
def get_transaction(id):
    logger.info(f'Received GET request to fetch transaction with ID: {id}')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM transactions WHERE id = %s', (id,))
        transaction = cursor.fetchone()
        cursor.close()
        conn.close()

        if not transaction:
            logger.warning(f'Transaction with ID {id} not found')
            return jsonify({'error': 'Transaction not found'}), 404

        # Map fields
        transaction['userId'] = transaction.pop('user_id')
        transaction['bookId'] = transaction.pop('book_id')
        transaction['transactionType'] = transaction.pop('transaction_type')
        transaction['transactionDate'] = transaction.pop('transaction_date').isoformat()

        logger.info(f'Transaction with ID {id} fetched successfully')
        return jsonify(transaction), 200

    except mysql.connector.Error as err:
        logger.error(f'Database error while fetching transaction {id}: {str(err)}')
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        logger.error(f'Server error while fetching transaction {id}: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get transactions by user ID
@app.route('/transactions/user/<int:user_id>', methods=['GET'])
def get_transactions_by_user(user_id):
    logger.info(f'Received GET request to fetch transactions for user ID: {user_id}')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM transactions WHERE user_id = %s', (user_id,))
        transactions = cursor.fetchall()
        cursor.close()
        conn.close()

        if not transactions:
            logger.info(f'No transactions found for user ID: {user_id}')
            return jsonify([]), 200

        # Map fields
        for transaction in transactions:
            transaction['userId'] = transaction.pop('user_id')
            transaction['bookId'] = transaction.pop('book_id')
            transaction['transactionType'] = transaction.pop('transaction_type')
            transaction['transactionDate'] = transaction.pop('transaction_date').isoformat()

        logger.info(f'Fetched {len(transactions)} transactions for user ID: {user_id}')
        return jsonify(transactions), 200

    except mysql.connector.Error as err:
        logger.error(f'Database error while fetching transactions for user {user_id}: {str(err)}')
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        logger.error(f'Server error while fetching transactions for user {user_id}: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Update a transaction
@app.route('/transactions/<int:id>', methods=['PUT'])
def update_transaction(id):
    logger.info(f'Received PUT request to update transaction with ID: {id}')
    try:
        data = request.get_json()
        logger.debug(f'Request data: {data}')

        user_id = data.get('userId')
        book_id = data.get('bookId')
        transaction_type = data.get('transactionType')

        if not all([user_id, book_id, transaction_type]):
            logger.warning('Missing required fields in request')
            return jsonify({'error': 'userId, bookId, and transactionType are required'}), 400

        if transaction_type not in ['BORROW', 'PURCHASE']:
            logger.warning(f'Invalid transactionType: {transaction_type}')
            return jsonify({'error': 'transactionType must be BORROW or PURCHASE'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            UPDATE transactions
            SET user_id = %s, book_id = %s, transaction_type = %s
            WHERE id = %s
        """
        cursor.execute(query, (user_id, book_id, transaction_type, id))
        conn.commit()

        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            logger.warning(f'Transaction with ID {id} not found for update')
            return jsonify({'error': 'Transaction not found'}), 404

        cursor.close()
        conn.close()
        logger.info(f'Transaction with ID {id} updated successfully')
        return jsonify({'message': 'Transaction updated'}), 200

    except mysql.connector.Error as err:
        logger.error(f'Database error while updating transaction {id}: {str(err)}')
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        logger.error(f'Server error while updating transaction {id}: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Delete a transaction
@app.route('/transactions/<int:id>', methods=['DELETE'])
def delete_transaction(id):
    logger.info(f'Received DELETE request to delete transaction with ID: {id}')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM transactions WHERE id = %s', (id,))
        conn.commit()

        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            logger.warning(f'Transaction with ID {id} not found for deletion')
            return jsonify({'error': 'Transaction not found'}), 404

        cursor.close()
        conn.close()

        return jsonify({'message': 'Transaction deleted'}), 200

    except mysql.connector.Error as err:
        logger.error(f'Database error while deleting transaction {id}: {str(err)}')
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        logger.error(f'Server error while deleting transaction {id}: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

if __name__ == '__main__':
    logger.info('Starting transactions-service on port 6000')
    app.run(debug=True, host='0.0.0.0', port=6000)