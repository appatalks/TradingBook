import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import TradeList from './components/TradeList';
import TradeForm from './components/TradeForm';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import Sidebar from './components/Sidebar';
import { Trade } from './types/Trade';
import './App.css';

const App: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial data
    loadTrades();
    
    // Set up electron listeners
    if (window.electronAPI) {
      window.electronAPI.onToggleTheme(() => {
        setDarkMode(prev => !prev);
      });
    }
  }, []);

  const loadTrades = async () => {
    try {
      setLoading(true);
      if (window.electronAPI) {
        const tradesData = await window.electronAPI.getTrades({});
        setTrades(tradesData);
      }
    } catch (error) {
      console.error('Failed to load trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTrade = async (trade: Omit<Trade, 'id'>) => {
    try {
      if (window.electronAPI) {
        const newTrade = await window.electronAPI.saveTrade(trade);
        setTrades(prev => [...prev, newTrade]);
      }
    } catch (error) {
      console.error('Failed to add trade:', error);
    }
  };

  const updateTrade = async (id: number, trade: Partial<Trade>) => {
    try {
      if (window.electronAPI) {
        const updatedTrade = await window.electronAPI.updateTrade(id, trade);
        setTrades(prev => prev.map(t => t.id === id ? updatedTrade : t));
      }
    } catch (error) {
      console.error('Failed to update trade:', error);
    }
  };

  const handleTradeSubmit = async (trade: Omit<Trade, 'id'>, id?: number) => {
    if (id) {
      await updateTrade(id, trade);
    } else {
      await addTrade(trade);
    }
  };

  const deleteTrade = async (id: number) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.deleteTrade(id);
        setTrades(prev => prev.filter(t => t.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete trade:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="flex bg-gray-50 dark:bg-gray-900 min-h-screen">
        <Router initialEntries={["/dashboard"]}>
          <Sidebar darkMode={darkMode} />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard trades={trades} />} />
              <Route path="/trades" element={<TradeList trades={trades} onUpdate={updateTrade} onDelete={deleteTrade} />} />
              <Route path="/trades/new" element={<TradeForm onSubmit={handleTradeSubmit} />} />
              <Route path="/trades/edit/:id" element={<TradeForm trades={trades} onSubmit={handleTradeSubmit} />} />
              <Route path="/analytics" element={<Analytics trades={trades} />} />
              <Route path="/settings" element={<Settings darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />} />
            </Routes>
          </main>
        </Router>
      </div>
    </div>
  );
};

export default App;
