import React from 'react';
import { Trade } from '../types/Trade';

interface RecentTradesWidgetProps {
  trades: Trade[];
  onSymbolClick?: (symbol: string) => void;
}

const RecentTradesWidget: React.FC<RecentTradesWidgetProps> = ({ trades, onSymbolClick }) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPnLColor = (pnl?: number) => {
    if (!pnl) return 'text-gray-500 dark:text-gray-400';
    return pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  if (trades.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No trades yet</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Your recent trades will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trades.map((trade) => (
        <div key={trade.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span 
                className={`font-medium cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 ${
                  onSymbolClick ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                }`}
                onClick={() => onSymbolClick?.(trade.symbol)}
                title={onSymbolClick ? "Click to view stock chart" : undefined}
              >
                {trade.symbol}
              </span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                trade.side === 'BUY' || trade.side === 'LONG'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              }`}>
                {trade.side}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {trade.assetType}
              </span>
            </div>
            {trade.pnl !== undefined && (
              <span className={`font-semibold ${getPnLColor(trade.pnl)}`}>
                {(trade.pnl ?? 0) >= 0 ? '+' : ''}${(trade.pnl ?? 0).toFixed(2)}
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span>{trade.quantity} @ ${(trade.entryPrice ?? 0).toFixed(2)}</span>
              {trade.exitPrice && (
                <span> → ${(trade.exitPrice ?? 0).toFixed(2)}</span>
              )}
            </div>
            <span>{formatDate(trade.entryDate)}</span>
          </div>

          {trade.strategy && (
            <div className="mt-2">
              <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-1 rounded">
                {trade.strategy}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default RecentTradesWidget;
