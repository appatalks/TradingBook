import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import packageJson from '../../package.json';

interface SidebarProps {
  darkMode: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ darkMode }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/trades', label: 'Trades', icon: '💰' },
    { path: '/trades/new', label: 'New Trade', icon: '➕' },
    { path: '/analytics', label: 'Analytics', icon: '📈' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="sidebar bg-white dark:bg-gray-800 shadow-lg h-screen">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">TradingBook</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Trading Journal</p>
      </div>
      
      <nav className="mt-6">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNavigation(item.path)}
            className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-colors text-left ${
              isActive(item.path)
                ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20 border-r-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
            }`}
          >
            <span className="text-lg mr-3">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="absolute bottom-4 left-4 right-4">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-left">
          TradingBook v{packageJson.version}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
