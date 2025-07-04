import React from 'react';
import './App.css';
import FramesTool from './components/frames-photo-tool';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import PWADebugPanel from './components/PWADebugPanel';
import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
    <div className="App">
      <FramesTool />
      <PWAInstallPrompt />
      <OfflineIndicator />
      {process.env.NODE_ENV === 'development' && <PWADebugPanel />}
      <Analytics />
    </div>
  );
}

export default App;
