import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'glass-card !bg-avenlo-card !text-white !border-avenlo-border',
          duration: 4000,
          style: {
            background: '#1A1A2E',
            color: '#fff',
            border: '1px solid #2D2D44',
          },
          success: {
            iconTheme: {
              primary: '#00D4FF',
              secondary: '#1A1A2E',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#1A1A2E',
            },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
