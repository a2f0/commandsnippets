import AppRouter from './AppRouter';
import React from 'react';
import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('©');
if (!rootElement) throw new Error('Failed to find the root element');
const root = ReactDOM.createRoot(rootElement);
root.render(<AppRouter />);
