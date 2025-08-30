import React from 'react';

interface MetricsCardProps {
  title: string;
  value: string;
  change: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
}

const MetricsCard: React.FC<MetricsCardProps> = ({ title, value, change, subtitle }) => {
  const getChangeColor = () => {
    switch (change) {
      case 'positive':
        return 'text-green-600 dark:text-green-400';
      case 'negative':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getBackgroundColor = () => {
    switch (change) {
      case 'positive':
        return 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800';
      case 'negative':
        return 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800';
      default:
        return 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div className={`p-6 rounded-lg border ${getBackgroundColor()}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className={`text-2xl font-semibold ${getChangeColor()}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${change === 'positive' ? 'bg-green-100 dark:bg-green-900/20' : change === 'negative' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
          <span className={`text-xl ${getChangeColor()}`}>
            {change === 'positive' ? '↗' : change === 'negative' ? '↘' : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MetricsCard;
