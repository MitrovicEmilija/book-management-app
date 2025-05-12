import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import axios from 'axios';

function TransactionList() {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/web/transactions');
        setTransactions(response.data);
      } catch (error) {
        alert('Failed to fetch transactions: ' + error.response?.data?.error);
      }
    };
    fetchTransactions();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Transactions</h2>
      <ul>
        {transactions.map(tx => (
          <li key={tx.id} className="mb-2">{tx.transactionType} - Book ID: {tx.bookId}</li>
        ))}
      </ul>
    </div>
  );
}

function CreateTransaction() {
  const [userId, setUserId] = useState('1');
  const [bookId, setBookId] = useState('');
  const [transactionType, setTransactionType] = useState('BORROW');

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/web/transactions', { userId, bookId, transactionType });
      alert('Transaction created');
    } catch (error) {
      alert('Failed to create transaction: ' + error.response?.data?.error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Create Transaction</h2>
      <form onSubmit={handleCreate} className="space-y-4">
        <input
          type="text"
          placeholder="Book ID"
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
          className="border p-2 w-full"
        />
        <select
          value={transactionType}
          onChange={(e) => setTransactionType(e.target.value)}
          className="border p-2 w-full"
        >
          <option value="BORROW">Borrow</option>
          <option value="RETURN">Return</option>
        </select>
        <button type="submit" className="bg-blue-500 text-white p-2">Create</button>
      </form>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<TransactionList />} />
      <Route path="/create" element={<CreateTransaction />} />
    </Routes>
  );
}

export default App;