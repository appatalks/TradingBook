import React, { useState, useEffect } from 'react';
import { Trade, PerformanceMetrics } from '../types/Trade';
import StockChart from './StockChart';

interface AnalyticsProps {
  trades: Trade[];
}

const Analytics: React.FC<AnalyticsProps> = ({ trades }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10)
  });
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

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
      const exitDate = trade.exitDate ? new Date(trade.exitDate).toDateString() : null;
      if (!exitDate) return; // Skip open trades
      
      if (!dailyMap.has(exitDate)) {
        dailyMap.set(exitDate, {
          trades: 0,
          wins: 0,
          pnl: 0
        });
      }

      const stats = dailyMap.get(exitDate)!;
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

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                          {new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
