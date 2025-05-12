import React, { useState, useEffect, Suspense, lazy, Component, useRef } from 'react';
import { createRoot } from 'react-dom/client'; // Import createRoot
import axios from 'axios';

// Lazy load microfrontends
const UserApp = lazy(() => import('mfe_user/App').then(module => ({ default: module.default })));
const BookApp = lazy(() => import('mfe_book/App').then(module => ({ default: module.default })));
const TransactionApp = lazy(() => import('mfe_transactions/App').then(module => ({ default: module.default })));

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-500 p-4">
          <h3>Error Loading Component</h3>
          <p>{this.state.error?.message || 'Unknown error'}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const MicroFrontend = ({ name, Component }) => {
  const containerRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && Component) {
      // Create a root and render the component
      rootRef.current = createRoot(containerRef.current);
      rootRef.current.render(<Component />);
    }

    return () => {
      // Cleanup: Unmount using the root
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
    };
  }, [name, Component]);

  return <div ref={containerRef} className="min-h-[200px]"></div>;
};

const App = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  const fetchDashboardData = async () => {
    if (!userId || !token) return;
    try {
      const response = await axios.get(`http://localhost:3000/api/web/dashboard/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDashboardData(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch dashboard data');
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [userId, token]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-3xl font-bold">Library Dashboard</h1>
      </header>
      <main className="p-4">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Enter User ID for Dashboard"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="p-2 border rounded mr-2"
          />
          <button
            onClick={fetchDashboardData}
            className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Load Dashboard
          </button>
        </div>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {dashboardData && (
          <div className="mb-6 p-4 bg-white rounded shadow">
            <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
            <div className="mb-4">
              <h3 className="text-xl">User</h3>
              {dashboardData.user ? (
                <p>{dashboardData.user.username} ({dashboardData.user.email})</p>
              ) : (
                <p>No user data</p>
              )}
            </div>
            <div className="mb-4">
              <h3 className="text-xl">Books</h3>
              {dashboardData.books.length > 0 ? (
                <ul className="list-disc pl-5">
                  {dashboardData.books.map((book) => (
                    <li key={book.id}>{book.title} by {book.author}</li>
                  ))}
                </ul>
              ) : (
                <p>No books</p>
              )}
            </div>
            <div>
              <h3 className="text-xl">Transactions</h3>
              {dashboardData.transactions.length > 0 ? (
                <ul className="list-disc pl-5">
                  {dashboardData.transactions.map((tx) => (
                    <li key={tx.id}>
                      {tx.transactionType} - Book ID: {tx.bookId} on {tx.transactionDate}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No transactions</p>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ErrorBoundary>
            <Suspense fallback={<div>Loading User Service...</div>}>
              <MicroFrontend name="UserApp" Component={UserApp} />
            </Suspense>
          </ErrorBoundary>
          <ErrorBoundary>
            <Suspense fallback={<div>Loading Book Service...</div>}>
              <MicroFrontend name="BookApp" Component={BookApp} />
            </Suspense>
          </ErrorBoundary>
          <ErrorBoundary>
            <Suspense fallback={<div>Loading Transaction Service...</div>}>
              <MicroFrontend name="TransactionApp" Component={TransactionApp} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default App;