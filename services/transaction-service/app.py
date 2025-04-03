import logging

from flask import Flask, request, jsonify

from db import get_db_connection

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

app = Flask(__name__)

# Create a new transaction
@app.route('/transactions', methods=['POST'])
def create_transaction():
    logger.info('Received POST request to create a transaction')
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

        db = get_db_connection()
        query = """
            INSERT INTO transactions (user_id, book_id, transaction_type)
            VALUES (%s, %s, %s)
        """
        transaction_id = db.insert(query, (user_id, book_id, transaction_type))
        logger.info(f'Transaction created with ID: {transaction_id}')
        db.close()

        return jsonify({
            'id': transaction_id,
            'userId': user_id,
            'bookId': book_id,
            'transactionType': transaction_type,
            'message': 'Transaction created'
        }), 201

    except Exception as e:
        logger.error(f'Server error while creating transaction: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get all transactions
@app.route('/transactions', methods=['GET'])
def get_all_transactions():
    logger.info('Received GET request to fetch all transactions')
    try:
        db = get_db_connection()
        transactions = db.select('SELECT * FROM transactions')
        logger.info(f'Fetched {len(transactions)} transactions')
        db.close()

        for transaction in transactions:
            transaction['userId'] = transaction.pop('user_id')
            transaction['bookId'] = transaction.pop('book_id')
            transaction['transactionType'] = transaction.pop('transaction_type')
            transaction['transactionDate'] = transaction['transaction_date'].isoformat()

        return jsonify(transactions), 200

    except Exception as e:
        logger.error(f'Server error while fetching transactions: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get a transaction by ID
@app.route('/transactions/<int:id>', methods=['GET'])
def get_transaction(id):
    logger.info(f'Received GET request to fetch transaction with ID: {id}')
    try:
        db = get_db_connection()
        transaction = db.select_one('SELECT * FROM transactions WHERE id = %s', (id,))
        db.close()

        if not transaction:
            logger.warning(f'Transaction with ID {id} not found')
            return jsonify({'error': 'Transaction not found'}), 404

        transaction['userId'] = transaction.pop('user_id')
        transaction['bookId'] = transaction.pop('book_id')
        transaction['transactionType'] = transaction.pop('transaction_type')
        transaction['transactionDate'] = transaction['transaction_date'].isoformat()

        logger.info(f'Transaction with ID {id} fetched successfully')
        return jsonify(transaction), 200

    except Exception as e:
        logger.error(f'Server error while fetching transaction {id}: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get transactions by user ID
@app.route('/transactions/user/<int:user_id>', methods=['GET'])
def get_transactions_by_user(user_id):
    logger.info(f'Received GET request to fetch transactions for user ID: {user_id}')
    try:
        db = get_db_connection()
        transactions = db.select('SELECT * FROM transactions WHERE user_id = %s', (user_id,))
        db.close()

        if not transactions:
            logger.info(f'No transactions found for user ID: {user_id}')
            return jsonify([]), 200

        for transaction in transactions:
            transaction['userId'] = transaction.pop('user_id')
            transaction['bookId'] = transaction.pop('book_id')
            transaction['transactionType'] = transaction.pop('transaction_type')
            transaction['transactionDate'] = transaction['transaction_date'].isoformat()

        logger.info(f'Fetched {len(transactions)} transactions for user ID: {user_id}')
        return jsonify(transactions), 200

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

        db = get_db_connection()
        query = """
            UPDATE transactions
            SET user_id = %s, book_id = %s, transaction_type = %s
            WHERE id = %s
        """
        row_count = db.update(query, (user_id, book_id, transaction_type, id))

        if row_count == 0:
            db.close()
            logger.warning(f'Transaction with ID {id} not found for update')
            return jsonify({'error': 'Transaction not found'}), 404

        db.close()
        logger.info(f'Transaction with ID {id} updated successfully')
        return jsonify({'message': 'Transaction updated'}), 200

    except Exception as e:
        logger.error(f'Server error while updating transaction {id}: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Delete a transaction
@app.route('/transactions/<int:id>', methods=['DELETE'])
def delete_transaction(id):
    logger.info(f'Received DELETE request to delete transaction with ID: {id}')
    try:
        db = get_db_connection()
        row_count = db.delete('DELETE FROM transactions WHERE id = %s', (id,))

        if row_count == 0:
            db.close()
            logger.warning(f'Transaction with ID {id} not found for deletion')
            return jsonify({'error': 'Transaction not found'}), 404

        db.close()
        logger.info(f'Transaction with ID {id} deleted successfully')
        return jsonify({'message': 'Transaction deleted'}), 200

    except Exception as e:
        logger.error(f'Server error while deleting transaction {id}: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

if __name__ == '__main__':
    logger.info('Starting transactions-service on port 6000')
    app.run(debug=True, host='0.0.0.0', port=6000)