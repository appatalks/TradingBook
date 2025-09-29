import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trade, CalendarDay, PerformanceMetrics, DailyNote } from '../types/Trade';
import PnLCalendar from './PnLCalendar';
import MetricsCard from './MetricsCard';
import RecentTradesWidget from './RecentTradesWidget';
import StockChart from './StockChart';

interface DashboardProps {
  trades: Trade[];
}

const Dashboard: React.FC<DashboardProps> = ({ trades }) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<{ date: Date; data: CalendarDay | null } | null>(null);
  const [dayTrades, setDayTrades] = useState<Trade[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [dailyNote, setDailyNote] = useState<DailyNote | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isModalExpanded, setIsModalExpanded] = useState(false);

  useEffect(() => {
    loadMetrics();
    loadCalendarData();
  }, [trades, selectedMonth, selectedYear]);

  // Listen for database refresh events to update metrics immediately
  useEffect(() => {
    if (window.electronAPI?.onDatabaseRestored) {
      const handleDatabaseRefresh = () => {
        console.log('Dashboard: Database refresh detected, reloading metrics and calendar...');
        loadMetrics();
        loadCalendarData();
      };
      
      window.electronAPI.onDatabaseRestored(handleDatabaseRefresh);
      
      // Cleanup function
      return () => {
        // Remove listener if cleanup function is available
        if (window.electronAPI?.removeDatabaseListeners) {
          window.electronAPI.removeDatabaseListeners();
        }
      };
    }
  }, [selectedMonth, selectedYear]);

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
      console.log('Dashboard: Clicked day with dateString:', dateString);
      
      // Find the calendar data for this day first
      const dayData = calendarData.find(d => {
        const calendarDateString = d.date instanceof Date ? d.date.toLocaleDateString('en-CA') : d.date;
        return calendarDateString === dateString;
      });
      
      // Always try to load trades for the selected day
      // Don't rely on calendar data accuracy - let the database tell us if trades exist
      const tradesForDay = await window.electronAPI.getTrades({
        startDate: dateString,
        endDate: dateString
      });
      
      console.log('Dashboard: Found trades for day:', tradesForDay.length);
      
      // Load daily note for this day with better error handling
      try {
        const note = await window.electronAPI.getDailyNote(dateString);
        console.log('Dashboard: Retrieved daily note:', note);
        setDailyNote(note);
        setNoteText(note?.notes || '');
      } catch (noteError) {
        console.error('Dashboard: Failed to load daily note:', noteError);
        setDailyNote(null);
        setNoteText('');
      }
      
      setDayTrades(tradesForDay);
      setSelectedDay({ date, data: dayData || null });
    } catch (error) {
      console.error('Dashboard: Failed to load day data:', error);
      setDayTrades([]);
      setDailyNote(null);
      setNoteText('');
      setSelectedDay({ date, data: null });
    }
  };

  const closeDayModal = () => {
    setSelectedDay(null);
    setDailyNote(null);
    setNoteText('');
    setIsSavingNote(false);
    setIsModalExpanded(false);
  };

  const handleAddTradeForDate = () => {
    if (!selectedDay) return;
    
    // Format the date as YYYY-MM-DD for the URL parameter
    const dateString = selectedDay.date.toLocaleDateString('en-CA');
    
    // Navigate to the trade form with the pre-selected date
    navigate(`/trades/new?date=${dateString}`);
  };

  const handleSaveNote = async () => {
    if (!selectedDay) return;
    
    try {
      setIsSavingNote(true);
      const dateString = selectedDay.date.toLocaleDateString('en-CA');
      console.log('Dashboard: Saving note for date:', dateString, 'Note text length:', noteText.length);
      
      if (noteText.trim()) {
        // Save or update note
        const saveResult = await window.electronAPI.saveDailyNote(dateString, noteText.trim());
        console.log('Dashboard: Save note result:', saveResult);
        
        // Reload the note to get updated data
        const updatedNote = await window.electronAPI.getDailyNote(dateString);
        console.log('Dashboard: Updated note after save:', updatedNote);
        setDailyNote(updatedNote);
      } else if (dailyNote) {
        // Delete note if text is empty and note exists
        console.log('Dashboard: Deleting empty note for date:', dateString);
        const deleteResult = await window.electronAPI.deleteDailyNote(dateString);
        console.log('Dashboard: Delete note result:', deleteResult);
        setDailyNote(null);
      }
    } catch (error) {
      console.error('Dashboard: Failed to save daily note:', error);
      alert('Failed to save note. Please try again.');
    } finally {
      setIsSavingNote(false);
    }
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
          <div className={`day-modal-content bg-white dark:bg-gray-800 rounded-lg p-6 w-full mx-4 overflow-y-auto transition-all duration-300 ${
            isModalExpanded 
              ? 'max-w-6xl max-h-[95vh]' 
              : 'max-w-2xl max-h-[80vh]'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedDay.date.toDateString()}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsModalExpanded(!isModalExpanded)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  title={isModalExpanded ? "Collapse view" : "Expand view"}
                >
                  {isModalExpanded ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8l4-4m0 0h4m-4 0v4m11-4l-4 4m0 0v4m0-4h4M4 16l4 4m0 0h4m-4 0v-4m11 4l-4-4m0 0v-4m0 4h4" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={closeDayModal}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Daily P&L and Trades Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Daily P&L:</span>
                  <span className={`font-semibold ${(selectedDay.data?.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${(selectedDay.data?.pnl ?? 0).toFixed(2)}
                  </span>
                </div>

                {/* Add Trade Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleAddTradeForDate}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Trade for {selectedDay.date.toLocaleDateString()}
                  </button>
                </div>
                
                {dayTrades.length > 0 ? (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Trades ({dayTrades.length}):</h4>
                    <div className={`space-y-2 overflow-y-auto ${isModalExpanded ? 'max-h-80' : 'max-h-40'}`}>
                      {dayTrades.map((trade) => (
                        <div key={`trade-${trade.id}`} className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              {trade.symbol} {trade.exitPrice ? 
                                (trade.side === 'BUY' || trade.side === 'LONG' ? 
                                  `${trade.side}/SELL` : 
                                  `${trade.side}/BUY`) : 
                                trade.side}
                            </span>
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
                ) : (selectedDay.data?.pnl !== undefined && selectedDay.data.pnl !== 0) ? (
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    Unable to load trade details for this day (P&L: ${(selectedDay.data.pnl ?? 0).toFixed(2)})
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    No trades on this day
                  </div>
                )}
              </div>

              {/* Daily Notes Section */}
              <div className="border-t pt-4 dark:border-gray-600">
                <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Daily Notes</h4>
                <div className="space-y-3">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add your notes for this day..."
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 ${isModalExpanded ? 'h-32' : 'h-24'}`}
                  />
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {dailyNote?.updatedAt && (
                        <span>Last updated: {new Date(dailyNote.updatedAt).toLocaleString()}</span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {dailyNote && noteText.trim() === '' && (
                        <button
                          onClick={handleSaveNote}
                          disabled={isSavingNote}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {isSavingNote ? 'Deleting...' : 'Delete Note'}
                        </button>
                      )}
                      <button
                        onClick={handleSaveNote}
                        disabled={isSavingNote || (noteText === (dailyNote?.notes || ''))}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSavingNote ? 'Saving...' : 'Save Note'}
                      </button>
                    </div>
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
          trades={trades.filter(trade => trade.symbol === selectedSymbol)}
          onClose={() => setSelectedSymbol(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
