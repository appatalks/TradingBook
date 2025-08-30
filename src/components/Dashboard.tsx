import React, { useState, useEffect } from 'react';
import { Trade, CalendarDay, PerformanceMetrics } from '../types/Trade';
import PnLCalendar from './PnLCalendar';
import MetricsCard from './MetricsCard';
import RecentTradesWidget from './RecentTradesWidget';
import StockChart from './StockChart';

interface DashboardProps {
  trades: Trade[];
}

const Dashboard: React.FC<DashboardProps> = ({ trades }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<{ date: Date; data: CalendarDay | null } | null>(null);
  const [dayTrades, setDayTrades] = useState<Trade[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
    loadCalendarData();
  }, [trades, selectedMonth, selectedYear]);

  const loadMetrics = async () => {
    try {
      if (window.electronAPI) {
        const metricsData = await window.electronAPI.getPerformanceMetrics({
          startDate: new Date(selectedYear, 0, 1),
          endDate: new Date(selectedYear, 11, 31)
        });
        setMetrics(metricsData);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const loadCalendarData = async () => {
    try {
      if (window.electronAPI) {
        const calData = await window.electronAPI.getCalendarData(selectedMonth, selectedYear);
        setCalendarData(calData);
      }
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    }
  };

    const handleDayClick = async (date: Date) => {
    try {
      // Format date as YYYY-MM-DD for SQLite filtering
      const dateString = date.toLocaleDateString('en-CA'); // Returns YYYY-MM-DD format
      
      // Find the calendar data for this day first
      const dayData = calendarData.find(d => {
        const calendarDateString = d.date instanceof Date ? d.date.toLocaleDateString('en-CA') : d.date;
        return calendarDateString === dateString;
      });
      
      if (!dayData || dayData.tradeCount === 0) {
        setDayTrades([]);
        setSelectedDay({ date, data: null });
        return;
      }
      
      const tradesForDay = await window.electronAPI.getTrades({
        startDate: dateString,
        endDate: dateString
      });
      
      setDayTrades(tradesForDay);
      setSelectedDay({ date, data: dayData });
    } catch (error) {
      console.error('Failed to load trades for day:', error);
      setDayTrades([]);
      setSelectedDay({ date, data: null });
    }
  };

  const closeDayModal = () => {
    setSelectedDay(null);
  };

  // Handle click outside modal to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const modal = document.querySelector('.day-modal-content');
      
      if (selectedDay && modal && !modal.contains(target)) {
        closeDayModal();
      }
    };

    if (selectedDay) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [selectedDay]);  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      </div>

      {/* Performance Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricsCard
            title="Total P&L"
            value={`$${(metrics.totalPnL ?? 0).toFixed(2)}`}
            change={(metrics.totalPnL ?? 0) >= 0 ? 'positive' : 'negative'}
          />
          <MetricsCard
            title="Win Rate"
            value={`${((metrics.winRate ?? 0) * 100).toFixed(1)}%`}
            change={(metrics.winRate ?? 0) >= 0.5 ? 'positive' : 'negative'}
          />
          <MetricsCard
            title="Total Trades"
            value={(metrics.totalTrades ?? 0).toString()}
            change="neutral"
          />
          <MetricsCard
            title="Profit Factor"
            value={(metrics.profitFactor ?? 0).toFixed(2)}
            change={(metrics.profitFactor ?? 0) >= 1 ? 'positive' : 'negative'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* P&L Calendar */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                P&L Calendar
              </h2>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {new Date(0, i).toLocaleDateString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i} value={new Date().getFullYear() - 5 + i}>
                      {new Date().getFullYear() - 5 + i}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="transform scale-90 origin-top-left">
              <PnLCalendar
                calendarData={calendarData}
                month={selectedMonth}
                year={selectedYear}
                onDayClick={handleDayClick}
              />
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Recent Trades
            </h2>
            <RecentTradesWidget 
              trades={trades.slice(0, 5)} 
              onSymbolClick={(symbol) => setSelectedSymbol(symbol)}
            />
          </div>
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="day-modal-content bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedDay.date.toDateString()}
              </h3>
              <button
                onClick={closeDayModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            {selectedDay.data ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Daily P&L:</span>
                  <span className={`font-semibold ${(selectedDay.data.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${(selectedDay.data.pnl ?? 0).toFixed(2)}
                  </span>
                </div>
                
                {dayTrades.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Trades ({dayTrades.length}):</h4>
                    <div className="space-y-2">
                      {dayTrades.map((trade) => (
                        <div key={`trade-${trade.id}`} className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{trade.symbol} {trade.side}</span>
                            <span className={(trade.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                              ${(trade.pnl ?? 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            Qty: {trade.quantity} @ Entry: ${(trade.entryPrice ?? 0).toFixed(2)}
                            {trade.exitPrice && ` • Exit: $${trade.exitPrice.toFixed(2)}`}
                          </div>
                          {trade.strategy && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Strategy: {trade.strategy}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {dayTrades.length === 0 && selectedDay.data && selectedDay.data.tradeCount > 0 && (
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    Unable to load trade details for this day.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No trades on this day</p>
            )}
          </div>
        </div>
      )}

      {/* Stock Chart Modal */}
      {selectedSymbol && (
        <StockChart 
          symbol={selectedSymbol} 
          trades={trades.filter(trade => trade.symbol === selectedSymbol)}
          onClose={() => setSelectedSymbol(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
