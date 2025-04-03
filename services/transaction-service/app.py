from flask import Flask, request, jsonify
import mysql.connector
from config import Config
from datetime import datetime

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
    try:
        data = request.get_json()
        user_id = data.get('userId')
        book_id = data.get('bookId')
        transaction_type = data.get('transactionType')

        if not all([user_id, book_id, transaction_type]):
            return jsonify({'error': 'userId, bookId, and transactionType are required'}), 400

        if transaction_type not in ['BORROW', 'PURCHASE']:
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
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get all transactions
@app.route('/transactions', methods=['GET'])
def get_all_transactions():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM transactions')
        transactions = cursor.fetchall()
        cursor.close()
        conn.close()

        # Map user_id to userId and book_id to bookId for consistency with other services
        for transaction in transactions:
            transaction['userId'] = transaction.pop('user_id')
            transaction['bookId'] = transaction.pop('book_id')
            transaction['transactionType'] = transaction.pop('transaction_type')
            transaction['transactionDate'] = transaction.pop('transaction_date').isoformat()

        return jsonify(transactions), 200

    except mysql.connector.Error as err:
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get transaction by id
@app.route('/transactions/<int:id>', methods=['GET'])
def get_transaction(id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM transactions WHERE id = %s', (id,))
        transaction = cursor.fetchone()
        cursor.close()
        conn.close()

        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404

        # Map fields
        transaction['userId'] = transaction.pop('user_id')
        transaction['bookId'] = transaction.pop('book_id')
        transaction['transactionType'] = transaction.pop('transaction_type')
        transaction['transactionDate'] = transaction.pop('transaction_date').isoformat()

        return jsonify(transaction), 200

    except mysql.connector.Error as err:
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get transactions by user ID
@app.route('/transactions/user/<int:user_id>', methods=['GET'])
def get_transactions_by_user(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM transactions WHERE user_id = %s', (user_id,))
        transactions = cursor.fetchall()
        cursor.close()
        conn.close()

        if not transactions:
            return jsonify([]), 200

        # Map fields
        for transaction in transactions:
            transaction['userId'] = transaction.pop('user_id')
            transaction['bookId'] = transaction.pop('book_id')
            transaction['transactionType'] = transaction.pop('transaction_type')
            transaction['transactionDate'] = transaction.pop('transaction_date').isoformat()

        return jsonify(transactions), 200

    except mysql.connector.Error as err:
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Update a transaction
@app.route('/transactions/<int:id>', methods=['PUT'])
def update_transaction(id):
    try:
        data = request.get_json()
        user_id = data.get('userId')
        book_id = data.get('bookId')
        transaction_type = data.get('transactionType')

        if not all([user_id, book_id, transaction_type]):
            return jsonify({'error': 'userId, bookId, and transactionType are required'}), 400

        if transaction_type not in ['BORROW', 'PURCHASE']:
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
            return jsonify({'error': 'Transaction not found'}), 404

        cursor.close()
        conn.close()

        return jsonify({'message': 'Transaction updated'}), 200

    except mysql.connector.Error as err:
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Delete a transaction
@app.route('/transactions/<int:id>', methods=['DELETE'])
def delete_transaction(id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM transactions WHERE id = %s', (id,))
        conn.commit()

        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Transaction not found'}), 404

        cursor.close()
        conn.close()

        return jsonify({'message': 'Transaction deleted'}), 200

    except mysql.connector.Error as err:
        return jsonify({'error': f'Database error: {str(err)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=6000)