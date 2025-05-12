import React from 'react';
import { createRoot } from 'react-dom/client';
import UserApp from './App.jsx';

if (process.env.NODE_ENV === 'development') {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(<UserApp />);
  } else {
    console.error('No container found for rendering mfe-user');
  }
}