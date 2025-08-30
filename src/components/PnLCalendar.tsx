import React from 'react';
import { CalendarDay } from '../types/Trade';

interface PnLCalendarProps {
  data: CalendarDay[];
  month: number;
  year: number;
}

const PnLCalendar: React.FC<PnLCalendarProps> = ({ data, month, year }) => {
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getDayData = (day: number) => {
    return data.find(d => d.date.getDate() === day);
  };

  const getCellClass = (dayData?: CalendarDay) => {
    if (!dayData || dayData.pnl === 0) {
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    }
    
    if (dayData.pnl > 0) {
      const intensity = Math.min(Math.abs(dayData.pnl) / 100, 1); // Normalize to 0-1
      return `bg-green-${Math.floor(intensity * 3 + 1)}00 text-green-800 dark:bg-green-900 dark:text-green-200`;
    } else {
      const intensity = Math.min(Math.abs(dayData.pnl) / 100, 1);
      return `bg-red-${Math.floor(intensity * 3 + 1)}00 text-red-800 dark:bg-red-900 dark:text-red-200`;
    }
  };

  const daysInMonth = getDaysInMonth(month, year);
  const firstDay = getFirstDayOfMonth(month, year);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const days: JSX.Element[] = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="w-10 h-10"></div>);
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = getDayData(day);
    days.push(
      <div
        key={day}
        className={`calendar-cell ${getCellClass(dayData)} cursor-pointer hover:scale-105 transition-transform`}
        title={dayData ? `${dayData.pnl > 0 ? '+' : ''}$${dayData.pnl.toFixed(2)} (${dayData.tradeCount} trades)` : 'No trades'}
      >
        {day}
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {monthNames[month]} {year}
        </h3>
      </div>
      
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 p-2">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center space-x-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-200 dark:bg-red-900 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Loss</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">No trades</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-200 dark:bg-green-900 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Profit</span>
        </div>
      </div>
    </div>
  );
};

export default PnLCalendar;
