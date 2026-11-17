import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';
import './styles/reference-shell.css';
import './styles/reference-pages.css';

try {
  const appearance = JSON.parse(localStorage.getItem('guf-appearance') || '{}');
  if (['light', 'dark', 'system'].includes(appearance.mode)) document.documentElement.dataset.theme = appearance.mode;
  if (['green', 'blue', 'purple', 'amber', 'rose'].includes(appearance.accent)) document.documentElement.dataset.accent = appearance.accent;
} catch {
  // Fall back to the default theme if browser storage is unavailable or invalid.
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
