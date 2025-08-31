import React from 'react';
import { CalendarDay } from '../types/Trade';

interface PnLCalendarProps {
  calendarData: CalendarDay[];
  month: number;
  year: number;
  onDayClick?: (date: Date, dayData: CalendarDay | null) => void;
}

const PnLCalendar: React.FC<PnLCalendarProps> = ({ calendarData, month, year, onDayClick }) => {
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getDayData = (day: number) => {
    return calendarData.find((d: CalendarDay) => d.date.getDate() === day);
  };

  const getCellClass = (day: number, dayData?: CalendarDay) => {
    const date = new Date(year, month, day);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6; // Sunday = 0, Saturday = 6
    
    let baseClass = 'flex flex-col items-center justify-center text-center rounded-lg border-2 min-h-[70px] w-full transition-all duration-200 hover:scale-105 hover:shadow-lg';
    
    if (isWeekend) {
      // Weekend styling - gray but still interactive
      if (!dayData || dayData.pnl === 0) {
        return `${baseClass} bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300`;
      } else if (dayData.pnl > 0) {
        return `${baseClass} bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300`;
      } else {
        return `${baseClass} bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300`;
      }
    }
    
    // Weekday styling
    if (!dayData || dayData.pnl === 0) {
      return `${baseClass} bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-500`;
    }
    
    if (dayData.pnl > 0) {
      const intensity = Math.min(Math.abs(dayData.pnl) / 100, 1); // Normalize to 0-1
      if (intensity > 0.7) {
        return `${baseClass} bg-green-500 dark:bg-green-600 border-green-600 dark:border-green-500 text-white`;
      } else if (intensity > 0.3) {
        return `${baseClass} bg-green-300 dark:bg-green-700 border-green-400 dark:border-green-600 text-green-800 dark:text-green-200`;
      } else {
        return `${baseClass} bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300`;
      }
    } else {
      const intensity = Math.min(Math.abs(dayData.pnl) / 100, 1);
      if (intensity > 0.7) {
        return `${baseClass} bg-red-500 dark:bg-red-600 border-red-600 dark:border-red-500 text-white`;
      } else if (intensity > 0.3) {
        return `${baseClass} bg-red-300 dark:bg-red-700 border-red-400 dark:border-red-600 text-red-800 dark:text-red-200`;
      } else {
        return `${baseClass} bg-red-100 dark:bg-red-900 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300`;
      }
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
    days.push(
      <div key={`empty-${i}`} className="min-h-[80px] w-full">
      </div>
    );
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = getDayData(day);
    const clickDate = new Date(year, month, day);
    
    days.push(
      <div
        key={day}
        className={`${getCellClass(day, dayData)} cursor-pointer`}
        title={dayData ? `${(dayData.pnl ?? 0) > 0 ? '+' : ''}$${(dayData.pnl ?? 0).toFixed(2)} (${dayData.trades} trades)` : 'No trades'}
        onClick={() => onDayClick?.(clickDate, dayData || null)}
      >
        <div className="text-lg font-bold mb-1">{day}</div>
        {dayData && (
          <div className="text-xs font-medium">
            {(dayData.pnl ?? 0) > 0 ? '+' : ''}${Math.abs(dayData.pnl ?? 0).toFixed(0)}
          </div>
        )}
        {dayData && (
          <div className="text-xs opacity-75">
            {dayData.trades} trade{dayData.trades !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {dayNames.map(day => (
          <div key={day} className="text-center text-sm font-bold text-gray-700 dark:text-gray-300 py-2">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {days}
      </div>

      {/* Legend - positioned inline with last week if possible */}
      <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 bg-red-300 dark:bg-red-700 border border-red-400 dark:border-red-600 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Loss</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">No trades</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 bg-green-300 dark:bg-green-700 border border-green-400 dark:border-green-600 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Profit</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Weekend</span>
        </div>
      </div>
    </div>
  );
};

export default PnLCalendar;
