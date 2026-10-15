import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.js';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find the app root element.');

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
