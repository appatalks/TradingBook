import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Trade } from '../types/Trade';

// StockChart component using Yahoo Finance API (same approach as ticker.sh)
// No API key required, uses the same endpoint as your ticker.sh script

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface StockChartProps {
  symbol: string;
  trades: Trade[];
  onClose: () => void;
}

interface StockDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const StockChart: React.FC<StockChartProps> = ({ symbol, trades, onClose }) => {
  const [stockData, setStockData] = useState<StockDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter trades for this symbol
  const symbolTrades = trades.filter(trade => 
    trade.symbol === symbol && trade.entryDate && trade.exitPrice !== undefined
  );

  useEffect(() => {
    fetchStockData();
  }, [symbol]);

  const fetchStockData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Yahoo Finance API (same as ticker.sh) - No API key required!
      const YAHOO_API_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart/';
      const YAHOO_API_SUFFIX = '?interval=1d&range=3mo'; // 3 months of data
      
      // Preflight request to get cookies (mimicking ticker.sh)
      try {
        await fetch('https://finance.yahoo.com', {
          method: 'GET',
          mode: 'no-cors',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'User-Agent': 'Chrome/115.0.0.0 Safari/537.36'
          }
        });
      } catch {
        // Ignore preflight errors
      }
      
      const yahooUrl = `${YAHOO_API_ENDPOINT}${symbol}${YAHOO_API_SUFFIX}`;
      const response = await fetch(yahooUrl, {
        headers: {
          'User-Agent': 'Chrome/115.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.chart?.error || !data.chart?.result?.[0]) {
        throw new Error('Invalid symbol or no data available');
      }
      
      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators?.quote?.[0];
      
      if (!timestamps || !quotes) {
        throw new Error('No price data available');
      }
      
      // Convert Yahoo Finance data to our format
      const chartData: StockDataPoint[] = timestamps.map((timestamp: number, index: number) => {
        const date = new Date(timestamp * 1000);
        return {
          date: date.toISOString().split('T')[0],
          open: quotes.open?.[index] || 0,
          high: quotes.high?.[index] || 0,
          low: quotes.low?.[index] || 0,
          close: quotes.close?.[index] || 0,
          volume: quotes.volume?.[index] || 0
        };
      }).filter((point: StockDataPoint) => point.close > 0); // Filter out invalid data points
      
      if (chartData.length === 0) {
        throw new Error('No valid price data found');
      }
      
      setStockData(chartData);
    } catch (err) {
      console.error('Error fetching stock data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stock data');
      
      // Fallback: Generate mock data for demonstration
      generateMockData();
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = () => {
    // Generate realistic mock data for demo purposes
    const mockData: StockDataPoint[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    let price = 100 + Math.random() * 100; // Random starting price between $100-200
    
    for (let i = 0; i < 90; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      // Generate realistic OHLC data
      const change = (Math.random() - 0.5) * 4; // Random change up to $2
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;
      const volume = Math.floor(Math.random() * 1000000) + 100000;
      
      mockData.push({
        date: date.toISOString().split('T')[0],
        open,
        high,
        low,
        close,
        volume
      });
      
      price = close;
    }
    
    setStockData(mockData);
  };

  const chartData = {
    labels: stockData.map(point => point.date),
    datasets: [
      {
        label: `${symbol} Close Price`,
        data: stockData.map(point => point.close),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 6,
      },
      // Add trade markers
      ...symbolTrades.map((trade, index) => ({
        label: `${trade.side} - ${trade.entryDate.toDateString()}`,
        data: stockData.map(point => {
          const tradeDate = trade.entryDate.toISOString().split('T')[0];
          return point.date === tradeDate ? trade.entryPrice : null;
        }),
        borderColor: trade.side === 'BUY' || trade.side === 'LONG' ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        backgroundColor: trade.side === 'BUY' || trade.side === 'LONG' ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        borderWidth: 0,
        pointRadius: 8,
        pointHoverRadius: 10,
        showLine: false,
        pointStyle: trade.side === 'BUY' || trade.side === 'LONG' ? 'triangle' : 'rectRot',
      })),
      // Add exit markers
      ...symbolTrades.filter(trade => trade.exitDate && trade.exitPrice).map((trade, index) => ({
        label: `Exit - ${trade.exitDate!.toDateString()}`,
        data: stockData.map(point => {
          const exitDate = trade.exitDate!.toISOString().split('T')[0];
          return point.date === exitDate ? trade.exitPrice : null;
        }),
        borderColor: (trade.pnl ?? 0) >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        backgroundColor: (trade.pnl ?? 0) >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        borderWidth: 0,
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false,
        pointStyle: 'circle',
      }))
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          filter: (legendItem: any) => {
            // Only show main price line in legend
            return legendItem.text.includes('Close Price');
          }
        }
      },
      title: {
        display: true,
        text: `${symbol} Stock Chart with Trade Markers`
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          afterLabel: (context: any) => {
            const dataIndex = context.dataIndex;
            const stockPoint = stockData[dataIndex];
            if (stockPoint && context.dataset.label.includes('Close Price')) {
              return [
                `Open: $${stockPoint.open.toFixed(2)}`,
                `High: $${stockPoint.high.toFixed(2)}`,
                `Low: $${stockPoint.low.toFixed(2)}`,
                `Volume: ${stockPoint.volume.toLocaleString()}`
              ];
            }
            return [];
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date'
        },
        ticks: {
          maxTicksLimit: 10
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Price ($)'
        },
        beginAtZero: false
      }
    },
    elements: {
      point: {
        hoverBorderWidth: 3
      }
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 h-96">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Loading {symbol} Chart...
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Chart Error
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Showing demo data instead. To use real data, get a free API key from Alpha Vantage.
            </p>
            <button
              onClick={fetchStockData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-6xl w-full mx-4 h-5/6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {symbol} Stock Chart
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        
        <div className="h-full pb-16">
          <Line data={chartData} options={options} />
        </div>
        
        {symbolTrades.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-medium mb-2">Trade Summary for {symbol}:</h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div>Total Trades: {symbolTrades.length}</div>
              <div className="flex space-x-4">
                <span>🔺 Entry markers show buy/sell points</span>
                <span>⚫ Exit markers show trade closes</span>
                <span className="text-green-600">Green = Profit</span>
                <span className="text-red-600">Red = Loss</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockChart;
