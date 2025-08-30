import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    getTrades: jest.fn().mockResolvedValue([]),
    saveTrade: jest.fn(),
    updateTrade: jest.fn(),
    deleteTrade: jest.fn(),
    onToggleTheme: jest.fn()
  },
  writable: true
});

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText('TradingBook')).toBeInTheDocument();
  });

  test('shows loading spinner initially', () => {
    render(<App />);
    const loadingSpinner = document.querySelector('.animate-spin');
    expect(loadingSpinner).toBeInTheDocument();
  });
});
