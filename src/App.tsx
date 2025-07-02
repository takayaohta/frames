import './App.css';
import FramesTool from './components/frames-photo-tool';
import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
    <div className="App">
      <FramesTool />
      <Analytics />
    </div>
  );
}

export default App;
