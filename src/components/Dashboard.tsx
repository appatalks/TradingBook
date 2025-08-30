import React, { useState, useEffect } from 'react';
import { Trade, CalendarDay, PerformanceMetrics } from '../types/Trade';
import PnLCalendar from './PnLCalendar';
import MetricsCard from './MetricsCard';
import RecentTradesWidget from './RecentTradesWidget';

interface DashboardProps {
  trades: Trade[];
}

const Dashboard: React.FC<DashboardProps> = ({ trades }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="flex space-x-4">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
            className="px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i} value={new Date().getFullYear() - 5 + i}>
                {new Date().getFullYear() - 5 + i}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Performance Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricsCard
            title="Total P&L"
            value={`$${metrics.totalPnL.toFixed(2)}`}
            change={metrics.totalPnL >= 0 ? 'positive' : 'negative'}
          />
          <MetricsCard
            title="Win Rate"
            value={`${(metrics.winRate * 100).toFixed(1)}%`}
            change={metrics.winRate >= 0.5 ? 'positive' : 'negative'}
          />
          <MetricsCard
            title="Total Trades"
            value={metrics.totalTrades.toString()}
            change="neutral"
          />
          <MetricsCard
            title="Profit Factor"
            value={metrics.profitFactor.toFixed(2)}
            change={metrics.profitFactor >= 1 ? 'positive' : 'negative'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* P&L Calendar */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              P&L Calendar
            </h2>
            <PnLCalendar
              data={calendarData}
              month={selectedMonth}
              year={selectedYear}
            />
          </div>
        </div>

        {/* Recent Trades */}
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Recent Trades
            </h2>
            <RecentTradesWidget trades={trades.slice(0, 5)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
