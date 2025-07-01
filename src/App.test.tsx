import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

test('renders frames photo tool', () => {
  render(<App />);
  const uploadElement = screen.getByText(/クリックして画像を選択/i);
  expect(uploadElement).toBeInTheDocument();
});
