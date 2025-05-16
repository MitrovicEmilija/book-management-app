import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './index.css';

// Lazy load remote microfrontends
const UserApp = lazy(() => import('mfe_user/App'));
const BookApp = lazy(() => import('mfe_book/App'));
const TransactionsApp = lazy(() => import('mfe_transactions/App'));

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-blue-600 p-4">
          <ul className="flex space-x-4 text-white">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/users">Users</Link></li>
            <li><Link to="/books">Books</Link></li>
            <li><Link to="/books/create">Create Book</Link></li>
            <li><Link to="/transactions">About us</Link></li>
          </ul>
        </nav>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/" element={<h1 className="text-2xl p-4">Welcome to the Library App</h1>} />
            <Route path="/users/*" element={<UserApp />} />
            <Route path="/books/*" element={<BookApp />} />
            <Route path="/transactions/*" element={<TransactionsApp />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;