import unittest
from unittest.mock import MagicMock, patch
from app import app
import json
from datetime import datetime

class TransactionsServiceTestCase(unittest.TestCase):
    def setUp(self):
        # Configure the app for testing
        app.config['TESTING'] = True
        self.app = app.test_client()

        # Mock the database
        self.mock_db = MagicMock()
        self.patcher = patch('app.get_db_connection', return_value=self.mock_db)
        self.patcher.start()

        # Reset the mock before each test
        self.mock_db.reset_mock()

    def tearDown(self):
        # Stop the patcher
        self.patcher.stop()

    def test_create_transaction_success(self):
        # Mock the insert method to return a transaction ID
        self.mock_db.insert.return_value = 1

        # Test creating a transaction with valid data
        response = self.app.post('/transactions',
            data=json.dumps({
                'userId': 123,
                'bookId': 1,
                'transactionType': 'BORROW'
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['id'], 1)
        self.assertEqual(data['userId'], 123)
        self.assertEqual(data['bookId'], 1)
        self.assertEqual(data['transactionType'], 'BORROW')
        self.assertEqual(data['message'], 'Transaction created')

        # Verify the database interaction
        self.mock_db.insert.assert_called_once_with(
            '\n            INSERT INTO transactions (user_id, book_id, transaction_type)\n            VALUES (%s, %s, %s)\n        ',
            (123, 1, 'BORROW')
        )
        self.mock_db.close.assert_called_once()

    def test_create_transaction_missing_fields(self):
        # Test creating a transaction with missing fields
        response = self.app.post('/transactions',
            data=json.dumps({
                'userId': 123,
                'bookId': 1
                # transactionType is missing
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'userId, bookId, and transactionType are required')

        # Verify no database interaction occurred
        self.mock_db.insert.assert_not_called()
        self.mock_db.close.assert_not_called()

    def test_create_transaction_invalid_type(self):
        # Test creating a transaction with invalid transactionType
        response = self.app.post('/transactions',
            data=json.dumps({
                'userId': 123,
                'bookId': 1,
                'transactionType': 'INVALID'
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'transactionType must be BORROW or PURCHASE')

        # Verify no database interaction occurred
        self.mock_db.insert.assert_not_called()
        self.mock_db.close.assert_not_called()

    def test_get_all_transactions_empty(self):
        # Mock the select method to return an empty list
        self.mock_db.select.return_value = []

        # Test fetching all transactions when the database is empty
        response = self.app.get('/transactions')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data, [])

        # Verify the database interaction
        self.mock_db.select.assert_called_once_with('SELECT * FROM transactions')
        self.mock_db.close.assert_called_once()

    def test_get_all_transactions_with_data(self):
        # Mock the select method to return a list of transactions
        mock_transactions = [
            {
                'id': 1,
                'user_id': 123,
                'book_id': 1,
                'transaction_type': 'BORROW',
                'transaction_date': datetime(2025, 4, 3, 12, 0, 0)
            }
        ]
        self.mock_db.select.return_value = mock_transactions

        # Test fetching all transactions
        response = self.app.get('/transactions')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['userId'], 123)
        self.assertEqual(data[0]['bookId'], 1)
        self.assertEqual(data[0]['transactionType'], 'BORROW')
        self.assertEqual(data[0]['transactionDate'], '2025-04-03T12:00:00')

        # Verify the database interaction
        self.mock_db.select.assert_called_once_with('SELECT * FROM transactions')
        self.mock_db.close.assert_called_once()

    def test_get_transaction_by_id_success(self):
        # Mock the select_one method to return a transaction
        mock_transaction = {
            'id': 1,
            'user_id': 123,
            'book_id': 1,
            'transaction_type': 'BORROW',
            'transaction_date': datetime(2025, 4, 3, 12, 0, 0)
        }
        self.mock_db.select_one.return_value = mock_transaction

        # Test fetching the transaction by ID
        response = self.app.get('/transactions/1')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['id'], 1)
        self.assertEqual(data['userId'], 123)
        self.assertEqual(data['bookId'], 1)
        self.assertEqual(data['transactionType'], 'BORROW')
        self.assertEqual(data['transactionDate'], '2025-04-03T12:00:00')

        # Verify the database interaction
        self.mock_db.select_one.assert_called_once_with('SELECT * FROM transactions WHERE id = %s', (1,))
        self.mock_db.close.assert_called_once()

    def test_get_transaction_by_id_not_found(self):
        # Mock the select_one method to return None
        self.mock_db.select_one.return_value = None

        # Test fetching a non-existent transaction
        response = self.app.get('/transactions/999')
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'Transaction not found')

        # Verify the database interaction
        self.mock_db.select_one.assert_called_once_with('SELECT * FROM transactions WHERE id = %s', (999,))
        self.mock_db.close.assert_called_once()

    def test_get_transactions_by_user_success(self):
        # Mock the select method to return a list of transactions
        mock_transactions = [
            {
                'id': 1,
                'user_id': 123,
                'book_id': 1,
                'transaction_type': 'BORROW',
                'transaction_date': datetime(2025, 4, 3, 12, 0, 0)
            },
            {
                'id': 2,
                'user_id': 123,
                'book_id': 2,
                'transaction_type': 'PURCHASE',
                'transaction_date': datetime(2025, 4, 3, 12, 1, 0)
            }
        ]
        self.mock_db.select.return_value = mock_transactions

        # Test fetching transactions for user 123
        response = self.app.get('/transactions/user/123')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['userId'], 123)
        self.assertEqual(data[1]['userId'], 123)

        # Verify the database interaction
        self.mock_db.select.assert_called_once_with('SELECT * FROM transactions WHERE user_id = %s', (123,))
        self.mock_db.close.assert_called_once()

    def test_get_transactions_by_user_no_transactions(self):
        # Mock the select method to return an empty list
        self.mock_db.select.return_value = []

        # Test fetching transactions for a user with no transactions
        response = self.app.get('/transactions/user/999')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data, [])

        # Verify the database interaction
        self.mock_db.select.assert_called_once_with('SELECT * FROM transactions WHERE user_id = %s', (999,))
        self.mock_db.close.assert_called_once()

    def test_update_transaction_success(self):
        # Mock the update method to return 1 (indicating 1 row affected)
        self.mock_db.update.return_value = 1

        # Test updating the transaction
        response = self.app.put('/transactions/1',
            data=json.dumps({
                'userId': 456,
                'bookId': 2,
                'transactionType': 'PURCHASE'
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Transaction updated')

        # Verify the database interaction
        self.mock_db.update.assert_called_once_with(
            '\n            UPDATE transactions\n            SET user_id = %s, book_id = %s, transaction_type = %s\n            WHERE id = %s\n        ',
            (456, 2, 'PURCHASE', 1)
        )
        self.mock_db.close.assert_called_once()

    def test_update_transaction_not_found(self):
        # Mock the update method to return 0 (indicating no rows affected)
        self.mock_db.update.return_value = 0

        # Test updating a non-existent transaction
        response = self.app.put('/transactions/999',
            data=json.dumps({
                'userId': 456,
                'bookId': 2,
                'transactionType': 'PURCHASE'
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'Transaction not found')

        # Verify the database interaction
        self.mock_db.update.assert_called_once_with(
            '\n            UPDATE transactions\n            SET user_id = %s, book_id = %s, transaction_type = %s\n            WHERE id = %s\n        ',
            (456, 2, 'PURCHASE', 999)
        )
        self.mock_db.close.assert_called_once()

    def test_delete_transaction_success(self):
        # Mock the delete method to return 1 (indicating 1 row affected)
        self.mock_db.delete.return_value = 1

        # Test deleting the transaction
        response = self.app.delete('/transactions/1')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Transaction deleted')

        # Verify the database interaction
        self.mock_db.delete.assert_called_once_with('DELETE FROM transactions WHERE id = %s', (1,))
        self.mock_db.close.assert_called_once()

    def test_delete_transaction_not_found(self):
        # Mock the delete method to return 0 (indicating no rows affected)
        self.mock_db.delete.return_value = 0

        # Test deleting a non-existent transaction
        response = self.app.delete('/transactions/999')
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'Transaction not found')

        # Verify the database interaction
        self.mock_db.delete.assert_called_once_with('DELETE FROM transactions WHERE id = %s', (999,))
        self.mock_db.close.assert_called_once()

if __name__ == '__main__':
    unittest.main()