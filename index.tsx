import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Import to trigger global JSX type augmentation for Three.js elements
import '@react-three/fiber';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);