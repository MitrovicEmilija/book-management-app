import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TransactionApp = () => {
  const [transactions, setTransactions] = useState([]);
  const [userId, setUserId] = useState('');
  const [bookId, setBookId] = useState('');
  const [transactionType, setTransactionType] = useState('BORROW');
  const [error, setError] = useState('');

  const API_URL = 'http://localhost:3000/api/web';

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API_URL}/transactions`);
      setTransactions(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch transactions');
    }
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/transactions`, { userId, bookId, transactionType });
      fetchTransactions();
      setUserId('');
      setBookId('');
      setTransactionType('BORROW');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create transaction');
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return (
    <div className="p-4 max-w-4xl mx-auto bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Transaction Service</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="mb-6">
        <h3 className="text-xl mb-2">Create Transaction</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input
            type="text"
            placeholder="User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Book ID"
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            className="p-2 border rounded"
          />
          <select
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="BORROW">Borrow</option>
            <option value="PURCHASE">Purchase</option>
          </select>
          <button
            onClick={handleCreateTransaction}
            className="col-span-1 sm:col-span-2 bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Create Transaction
          </button>
        </div>
      </div>
      <h3 className="text-xl mb-2">Transactions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="p-4 border rounded">
            <p>User ID: {transaction.userId}</p>
            <p>Book ID: {transaction.bookId}</p>
            <p>Type: {transaction.transactionType}</p>
            <p>Date: {transaction.transactionDate}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransactionApp;