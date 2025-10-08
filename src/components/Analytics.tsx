import React, { useState, useEffect, useMemo } from 'react';
import { Trade, PerformanceMetrics } from '../types/Trade';
import StockChart from './StockChart';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

interface AnalyticsProps {
  trades: Trade[];
}

type TabType = 'overview' | 'detailed' | 'winloss' | 'drawdown' | 'washwatch';
type TimeRangeType = 30 | 60 | 90 | 'ytd';

const Analytics: React.FC<AnalyticsProps> = ({ trades }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toLocaleDateString('en-CA'),
    endDate: new Date().toLocaleDateString('en-CA')
  });
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [timeRange, setTimeRange] = useState<TimeRangeType>(90);

  useEffect(() => {
    loadMetrics();
  }, [trades, dateRange]);

  const loadMetrics = async () => {
    try {
      if (window.electronAPI) {
        const metricsData = await window.electronAPI.getPerformanceMetrics({
          startDate: new Date(dateRange.startDate),
          endDate: new Date(dateRange.endDate)
        });
        setMetrics(metricsData);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  // Calculate daily P&L data for charts
  const dailyPnLData = useMemo(() => {
    const dailyMap = new Map<string, { pnl: number; wins: number; losses: number; trades: number }>();
    
    const filteredTrades = trades.filter(t => {
      if (t.pnl === undefined) return false;
      // Use exitDate if available (when P&L was realized), otherwise use entryDate
      const pnlDate = t.exitDate || t.entryDate;
      if (!pnlDate) return false;
      const tradeDate = new Date(pnlDate);
      
      // Calculate cutoff date based on time range
      let cutoffDate: Date;
      if (timeRange === 'ytd') {
        // Year to date - start of current year
        cutoffDate = new Date(new Date().getFullYear(), 0, 1);
      } else {
        // Days-based ranges (30, 60, 90)
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - timeRange);
      }
      
      return tradeDate >= cutoffDate;
    });

    filteredTrades.forEach(trade => {
      // Use exitDate if available (when P&L was realized), otherwise use entryDate
      const pnlDate = trade.exitDate || trade.entryDate;
      // Use toLocaleDateString('en-CA') to get YYYY-MM-DD in local timezone (avoid UTC shift)
      const dateKey = new Date(pnlDate).toLocaleDateString('en-CA');
      
      // Debug logging for large losses
      if (trade.pnl && trade.pnl < -700) {
        console.log('Analytics Debug:', {
          symbol: trade.symbol,
          pnl: trade.pnl,
          exitDate: trade.exitDate,
          entryDate: trade.entryDate,
          pnlDate: pnlDate,
          parsedDate: new Date(pnlDate).toString(),
          dateKey: dateKey
        });
      }
      
      const existing = dailyMap.get(dateKey) || { pnl: 0, wins: 0, losses: 0, trades: 0 };
      
      existing.pnl += trade.pnl || 0;
      existing.trades += 1;
      if (trade.pnl! > 0) existing.wins += 1;
      if (trade.pnl! < 0) existing.losses += 1;
      
      dailyMap.set(dateKey, existing);
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [trades, timeRange]);

  // Calculate cumulative P&L
  const cumulativePnLData = useMemo(() => {
    let cumulative = 0;
    return dailyPnLData.map(day => {
      cumulative += day.pnl;
      return { date: day.date, cumulative };
    });
  }, [dailyPnLData]);

  // Calculate drawdown data
  const drawdownData = useMemo(() => {
    let peak = 0;
    let cumulative = 0;
    
    return dailyPnLData.map(day => {
      cumulative += day.pnl;
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak > 0 ? ((peak - cumulative) / peak) * 100 : 0;
      return { date: day.date, drawdown, peak, current: cumulative };
    });
  }, [dailyPnLData]);

  const getWinLossStats = () => {
    const completedTrades = trades.filter(t => t.pnl !== undefined);
    const winners = completedTrades.filter(t => t.pnl! > 0);
    const losers = completedTrades.filter(t => t.pnl! < 0);
    
    return {
      total: completedTrades.length,
      winners: winners.length,
      losers: losers.length,
      avgWin: winners.length > 0 ? winners.reduce((sum, t) => sum + t.pnl!, 0) / winners.length : 0,
      avgLoss: losers.length > 0 ? losers.reduce((sum, t) => sum + t.pnl!, 0) / losers.length : 0
    };
  };

  const getSymbolStats = () => {
    const symbolMap = new Map<string, { trades: number; pnl: number; wins: number }>();
    
    trades.forEach(trade => {
      if (trade.pnl !== undefined) {
        const current = symbolMap.get(trade.symbol) || { trades: 0, pnl: 0, wins: 0 };
        symbolMap.set(trade.symbol, {
          trades: current.trades + 1,
          pnl: current.pnl + trade.pnl,
          wins: current.wins + (trade.pnl > 0 ? 1 : 0)
        });
      }
    });

    return Array.from(symbolMap.entries())
      .map(([symbol, stats]) => ({
        symbol,
        ...stats,
        winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0
      }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 10);
  };

  const getStrategyStats = () => {
    const strategyMap = new Map<string, { trades: number; pnl: number; wins: number }>();
    
    trades.forEach(trade => {
      if (trade.pnl !== undefined && trade.strategy) {
        const current = strategyMap.get(trade.strategy) || { trades: 0, pnl: 0, wins: 0 };
        strategyMap.set(trade.strategy, {
          trades: current.trades + 1,
          pnl: current.pnl + trade.pnl,
          wins: current.wins + (trade.pnl > 0 ? 1 : 0)
        });
      }
    });

    return Array.from(strategyMap.entries())
      .map(([strategy, stats]) => ({
        strategy,
        ...stats,
        winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0
      }))
      .sort((a, b) => b.pnl - a.pnl);
  };

  const getDailyStats = () => {
    if (!trades) return [];

    const dailyMap = new Map();

    trades.forEach(trade => {
      // Use exitDate if available (when P&L was realized), otherwise use entryDate
      const pnlDate = trade.exitDate || trade.entryDate;
      if (!pnlDate) return;
      // Use toLocaleDateString('en-CA') to get YYYY-MM-DD in local timezone
      const dateKey = new Date(pnlDate).toLocaleDateString('en-CA');
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          trades: 0,
          wins: 0,
          pnl: 0
        });
      }

      const stats = dailyMap.get(dateKey)!;
      stats.trades++;
      if (trade.pnl && trade.pnl > 0) stats.wins++;
      stats.pnl += trade.pnl || 0;
    });

    return Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        trades: stats.trades,
        pnl: stats.pnl,
        winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10); // Show top 10 recent days
  };

  const winLossStats = getWinLossStats();
  const symbolStats = getSymbolStats();
  const strategyStats = getStrategyStats();
  const dailyStats = getDailyStats();

  // Chart configurations
  const dailyPnLChartData = {
    labels: dailyPnLData.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Daily P&L',
        data: dailyPnLData.map(d => d.pnl),
        backgroundColor: dailyPnLData.map(d => d.pnl >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'),
        borderColor: dailyPnLData.map(d => d.pnl >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'),
        borderWidth: 1,
      },
    ],
  };

  const cumulativePnLChartData = {
    labels: cumulativePnLData.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Cumulative P&L',
        data: cumulativePnLData.map(d => d.cumulative),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const winRateChartData = {
    labels: dailyPnLData.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Win Rate %',
        data: dailyPnLData.map(d => d.trades > 0 ? (d.wins / d.trades) * 100 : 0),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      },
    ],
  };

  const volumeChartData = {
    labels: dailyPnLData.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Trade Volume',
        data: dailyPnLData.map(d => d.trades),
        backgroundColor: 'rgba(99, 102, 241, 0.6)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1,
      },
    ],
  };

  const drawdownChartData = {
    labels: drawdownData.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Drawdown %',
        data: drawdownData.map(d => -d.drawdown),
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Wash Sale Watch calculation
  const washSaleRisks = useMemo(() => {
    const riskMap = new Map<string, {
      symbol: string;
      lossDate: Date;
      lossAmount: number;
      safeDate: Date;
      daysRemaining: number;
      hasTrigger: boolean;
      lossCount: number;
    }>();

    // Get trades with realized losses (closed positions)
    const lossTrades = trades.filter(trade => {
      if (!trade.exitDate || !trade.exitPrice) return false;
      
      const loss = trade.side === 'BUY' || trade.side === 'LONG'
        ? (trade.exitPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - trade.exitPrice) * trade.quantity;
      
      return loss < 0;
    });

    // For each loss trade, check for wash sale triggers
    lossTrades.forEach(lossTrade => {
      const lossDate = new Date(lossTrade.exitDate!);
      const safeDate = new Date(lossDate);
      safeDate.setDate(safeDate.getDate() + 30);
      
      const today = new Date();
      const daysRemaining = Math.ceil((safeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Only show if within the 30-day window
      if (daysRemaining > 0) {
        const lossAmount = lossTrade.side === 'BUY' || lossTrade.side === 'LONG'
          ? (lossTrade.exitPrice! - lossTrade.entryPrice) * lossTrade.quantity
          : (lossTrade.entryPrice - lossTrade.exitPrice!) * lossTrade.quantity;

        const existing = riskMap.get(lossTrade.symbol);
        
        if (!existing) {
          // First loss for this symbol - check for triggers
          const hasTrigger = trades.some(trade => {
            if (trade.symbol !== lossTrade.symbol || trade.id === lossTrade.id) return false;
            
            const entryDate = new Date(trade.entryDate);
            const lossExitDate = new Date(lossTrade.exitDate!);
            const thirtyDaysAfterLoss = new Date(lossExitDate);
            thirtyDaysAfterLoss.setDate(thirtyDaysAfterLoss.getDate() + 30);
            
            return entryDate > lossExitDate && entryDate <= thirtyDaysAfterLoss;
          });

          riskMap.set(lossTrade.symbol, {
            symbol: lossTrade.symbol,
            lossDate,
            lossAmount,
            safeDate,
            daysRemaining,
            hasTrigger,
            lossCount: 1
          });
        } else {
          // Symbol already exists - update with most recent date and accumulate losses
          if (lossDate > existing.lossDate) {
            // This is a more recent loss - update date info but keep accumulated amount
            const hasTrigger = trades.some(trade => {
              if (trade.symbol !== lossTrade.symbol || trade.id === lossTrade.id) return false;
              
              const entryDate = new Date(trade.entryDate);
              const lossExitDate = new Date(lossTrade.exitDate!);
              const thirtyDaysAfterLoss = new Date(lossExitDate);
              thirtyDaysAfterLoss.setDate(thirtyDaysAfterLoss.getDate() + 30);
              
              return entryDate > lossExitDate && entryDate <= thirtyDaysAfterLoss;
            });

            riskMap.set(lossTrade.symbol, {
              symbol: lossTrade.symbol,
              lossDate, // Most recent loss date
              lossAmount: existing.lossAmount + lossAmount, // Accumulate all losses
              safeDate, // Based on most recent loss
              daysRemaining, // Based on most recent loss
              hasTrigger: existing.hasTrigger || hasTrigger, // Triggered if any loss was triggered
              lossCount: existing.lossCount + 1
            });
          } else {
            // This is an older loss - just add to the amount
            existing.lossAmount += lossAmount;
            existing.lossCount += 1;
          }
        }
      }
    });

    // Convert map to array and sort by days remaining (most urgent first)
    return Array.from(riskMap.values()).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [trades]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        },
      },
    },
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range and Time Range Filters */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <div className="flex space-x-4">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('detailed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'detailed'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Detailed
            </button>
            <button
              onClick={() => setActiveTab('winloss')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'winloss'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Win vs Loss Days
            </button>
            <button
              onClick={() => setActiveTab('drawdown')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'drawdown'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Drawdown
            </button>
            <button
              onClick={() => setActiveTab('washwatch')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'washwatch'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Wash Watch
            </button>
          </nav>
        </div>

        {/* Time Range Filter for Charts */}
        {activeTab !== 'overview' && (
          <div className="flex justify-end px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-2">
              <button
                onClick={() => setTimeRange(30)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  timeRange === 30
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                30 Days
              </button>
              <button
                onClick={() => setTimeRange(60)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  timeRange === 60
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                60 Days
              </button>
              <button
                onClick={() => setTimeRange(90)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  timeRange === 90
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                90 Days
              </button>
              <button
                onClick={() => setTimeRange('ytd')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  timeRange === 'ytd'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                YTD
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Overview Tab (Original Content) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">

          {/* Overview Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total P&L</h3>
              <p className={`text-2xl font-bold ${(metrics.totalPnL ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {(metrics.totalPnL ?? 0) >= 0 ? '+' : ''}${(metrics.totalPnL ?? 0).toFixed(2)}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Win Rate</h3>
              <p className={`text-2xl font-bold ${(metrics.winRate ?? 0) >= 0.5 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {((metrics.winRate ?? 0) * 100).toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {metrics.winningTrades ?? 0}W / {metrics.losingTrades ?? 0}L
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Profit Factor</h3>
              <p className={`text-2xl font-bold ${(metrics.profitFactor ?? 0) >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {(metrics.profitFactor ?? 0).toFixed(2)}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Trades</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.totalTrades}
              </p>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Win/Loss Analysis</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Average Win:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                ${(winLossStats.avgWin ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Average Loss:</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                ${(winLossStats.avgLoss ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Largest Win:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                ${(metrics.largestWin ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Largest Loss:</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                ${(metrics.largestLoss ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Sharpe Ratio:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {(metrics.sharpeRatio ?? 0).toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Max Drawdown:</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                {(metrics.maxDrawdown ?? 0).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Risk/Reward:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {(winLossStats.avgLoss ?? 0) !== 0 ? (Math.abs((winLossStats.avgWin ?? 0) / (winLossStats.avgLoss ?? 0))).toFixed(2) : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-side tables: Top Symbols and Daily Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Symbols */}
        {symbolStats.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Symbols by P&L</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Trades</th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">P&L</th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {symbolStats.map((stat) => (
                      <tr key={stat.symbol}>
                        <td className="py-2 px-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
                            onClick={() => setSelectedSymbol(stat.symbol)}
                            title="Click to view stock chart">
                          {stat.symbol}
                        </td>
                        <td className="py-2 px-2 text-sm text-right text-gray-600 dark:text-gray-400">
                          {stat.trades}
                        </td>
                        <td className={`py-2 px-2 text-sm text-right font-medium ${
                          stat.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {stat.pnl >= 0 ? '+' : ''}${stat.pnl.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-sm text-right text-gray-600 dark:text-gray-400">
                          {stat.winRate.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Daily Win Rate */}
        {dailyStats.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Performance (Recent 10 Days)</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Date</th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Trades</th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">P&L</th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {dailyStats.map((stat, index) => (
                      <tr key={`${stat.date}-${index}`}>
                        <td className="py-2 px-2 text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(stat.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-2 px-2 text-sm text-right text-gray-600 dark:text-gray-400">
                          {stat.trades}
                        </td>
                        <td className={`py-2 px-2 text-sm text-right font-medium ${
                          stat.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {stat.pnl >= 0 ? '+' : ''}${stat.pnl.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-sm text-right text-gray-600 dark:text-gray-400">
                          {stat.winRate.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

          {/* Strategy Performance */}
          {strategyStats.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Strategy Performance</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Strategy</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Trades</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-500 dark:text-gray-400">P&L</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Win Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {strategyStats.map((stat) => (
                        <tr key={stat.strategy}>
                          <td className="py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {stat.strategy}
                          </td>
                          <td className="py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                            {stat.trades}
                          </td>
                          <td className={`py-3 text-sm text-right font-medium ${
                            stat.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {stat.pnl >= 0 ? '+' : ''}${stat.pnl.toFixed(2)}
                          </td>
                          <td className="py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                            {stat.winRate.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed Tab */}
      {activeTab === 'detailed' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* NET DAILY P&L Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                NET DAILY P&L ({timeRange} Days)
              </h3>
              <div className="h-80">
                <Bar data={dailyPnLChartData} options={chartOptions} />
              </div>
            </div>

            {/* NET CUMULATIVE P&L Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                NET CUMULATIVE P&L ({timeRange} Days)
              </h3>
              <div className="h-80">
                <Line data={cumulativePnLChartData} options={chartOptions} />
              </div>
            </div>

            {/* DAILY VOLUME Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                DAILY VOLUME ({timeRange} Days)
              </h3>
              <div className="h-80">
                <Bar data={volumeChartData} options={chartOptions} />
              </div>
            </div>

            {/* WIN % Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                WIN % ({timeRange} Days)
              </h3>
              <div className="h-80">
                <Bar data={winRateChartData} options={{
                  ...chartOptions,
                  scales: {
                    ...chartOptions.scales,
                    y: {
                      ...chartOptions.scales.y,
                      min: 0,
                      max: 100,
                    },
                  },
                  plugins: {
                    ...chartOptions.plugins,
                    annotation: {
                      annotations: {
                        targetLine: {
                          type: 'line',
                          yMin: 70,
                          yMax: 70,
                          borderColor: 'rgba(16, 185, 129, 0.3)',
                          borderWidth: 2,
                          borderDash: [5, 5],
                          label: {
                            display: true,
                            content: 'Target: 70%',
                            position: 'end',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            color: 'rgba(16, 185, 129, 0.8)',
                            font: {
                              size: 11,
                            },
                          },
                        },
                      },
                    },
                  },
                }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Win vs Loss Days Tab */}
      {activeTab === 'winloss' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Daily P&L Distribution
              </h3>
              <div className="h-96">
                <Bar data={dailyPnLChartData} options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: { display: true },
                  },
                }} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Win/Loss Statistics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Winning Days:</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {dailyPnLData.filter(d => d.pnl > 0).length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Losing Days:</span>
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">
                    {dailyPnLData.filter(d => d.pnl < 0).length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Break-even Days:</span>
                  <span className="text-lg font-bold text-gray-600 dark:text-gray-400">
                    {dailyPnLData.filter(d => d.pnl === 0).length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Average Win Day:</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    ${dailyPnLData.filter(d => d.pnl > 0).length > 0
                      ? (dailyPnLData.filter(d => d.pnl > 0).reduce((sum, d) => sum + d.pnl, 0) / 
                         dailyPnLData.filter(d => d.pnl > 0).length).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Average Loss Day:</span>
                  <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    ${dailyPnLData.filter(d => d.pnl < 0).length > 0
                      ? (dailyPnLData.filter(d => d.pnl < 0).reduce((sum, d) => sum + d.pnl, 0) / 
                         dailyPnLData.filter(d => d.pnl < 0).length).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawdown Tab */}
      {activeTab === 'drawdown' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Drawdown Analysis ({timeRange} Days)
            </h3>
            <div className="h-96">
              <Line data={drawdownChartData} options={chartOptions} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Max Drawdown</h3>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {metrics.maxDrawdown.toFixed(2)}%
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Drawdown</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {drawdownData.length > 0 ? drawdownData[drawdownData.length - 1].drawdown.toFixed(2) : '0.00'}%
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Peak Equity</h3>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${drawdownData.length > 0 ? drawdownData[drawdownData.length - 1].peak.toFixed(2) : '0.00'}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Drawdown Periods</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Drawdown</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Peak</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Current</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {drawdownData.filter(d => d.drawdown > 5).slice(-10).map((data, index) => (
                    <tr key={index}>
                      <td className="py-2 text-sm text-gray-900 dark:text-white">
                        {new Date(data.date + 'T12:00:00').toLocaleDateString()}
                      </td>
                      <td className="py-2 text-sm text-right text-red-600 dark:text-red-400 font-medium">
                        -{data.drawdown.toFixed(2)}%
                      </td>
                      <td className="py-2 text-sm text-right text-gray-600 dark:text-gray-400">
                        ${data.peak.toFixed(2)}
                      </td>
                      <td className="py-2 text-sm text-right text-gray-600 dark:text-gray-400">
                        ${data.current.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Wash Watch Tab */}
      {activeTab === 'washwatch' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Wash Sale Watch</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Symbols you should avoid trading for 30 days after a loss to preserve your tax deduction
              </p>
            </div>

            {washSaleRisks.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">All Clear!</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  No wash sale risks detected. You're safe to trade all symbols.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Loss Date</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Loss Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Safe After</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Days Left</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {washSaleRisks.map((risk, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                          {risk.symbol}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {risk.lossDate.toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-red-600 dark:text-red-400 font-medium">
                          -${Math.abs(risk.lossAmount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {risk.safeDate.toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            risk.daysRemaining <= 7
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              : risk.daysRemaining <= 14
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {risk.daysRemaining}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {risk.hasTrigger ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              ⚠️ Triggered
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                              ⏳ At Risk
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    About Wash Sales
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
                    <p>
                      A wash sale occurs when you sell a security at a loss and repurchase the same or substantially 
                      identical security within 30 days. The IRS disallows the loss deduction in such cases. 
                      To safely claim your loss, wait 30 days after the loss before trading that symbol again.
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li><strong>⚠️ Triggered:</strong> You already repurchased this symbol within 30 days of the loss - wash sale applied</li>
                      <li><strong>⏳ At Risk:</strong> Avoid trading this symbol until the "Safe After" date to preserve your tax loss</li>
                      <li><strong>Days Left:</strong> Number of days remaining until you can safely trade without triggering a wash sale</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Stock Chart Modal */}
      {selectedSymbol && (
        <StockChart
          symbol={selectedSymbol}
          trades={trades || []}
          onClose={() => setSelectedSymbol(null)}
        />
      )}
    </div>
  );
};

export default Analytics;
