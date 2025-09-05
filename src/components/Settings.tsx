import React, { useState, useEffect } from 'react';
import debugLogger from '../utils/debugLogger';
import packageJson from '../../package.json';

interface SettingsProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const Settings: React.FC<SettingsProps> = ({ darkMode, onToggleDarkMode }) => {
  const [settings, setSettings] = useState({
    defaultCommission: '0.00',
    currency: 'USD',
    timezone: 'America/New_York',
    notifications: true,
    autoCalculatePnL: true,
    exportFormat: 'CSV',
    debugMode: true, // Enable debug logging by default
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error' | 'info'} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{message: string; onConfirm: () => void} | null>(null);
  const [debugStatus, setDebugStatus] = useState<any>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [databasePath, setDatabasePath] = useState<string>('Loading...');

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  };

  useEffect(() => {
    loadSettings();
    // Load database path after a short delay to ensure the main process is ready
    setTimeout(() => {
      loadDatabasePath();
    }, 100);
  }, []);

  const loadSettings = async () => {
    try {
      if (window.electronAPI) {
        const loadedSettings = await window.electronAPI.loadSettings();
        setSettings(loadedSettings);
        // Apply debug settings immediately
        if (loadedSettings.debugMode !== undefined) {
          debugLogger.setEnabled(loadedSettings.debugMode);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDatabasePath = async () => {
    try {
      if (window.electronAPI) {
        debugLogger.log('Loading database path...');
        const result = await window.electronAPI.getDatabaseStatus();
        debugLogger.log('Database status result:', result);
        if (result.success && result.status.dbPath) {
          debugLogger.log('Setting database path to:', result.status.dbPath);
          setDatabasePath(result.status.dbPath);
          // Force a re-render to ensure the UI updates
          setTimeout(() => {
            setDatabasePath(result.status.dbPath);
          }, 50);
        } else {
          debugLogger.log('Failed to get database path:', result);
          setDatabasePath('Error loading database path');
        }
      }
    } catch (error) {
      console.error('Failed to get database path:', error);
      debugLogger.log('Database path loading error:', error);
      setDatabasePath('Error loading database path');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (window.electronAPI) {
        const settingsToSave = { ...settings, darkMode };
        await window.electronAPI.saveSettings(settingsToSave);
        // Apply debug settings immediately
        debugLogger.setEnabled(settings.debugMode);
        debugLogger.log('Settings saved successfully');
        // Show a brief success message
        const saveButton = document.querySelector('.save-settings-btn');
        if (saveButton) {
          const originalText = saveButton.textContent;
          saveButton.textContent = 'Saved!';
          saveButton.classList.add('bg-green-600');
          saveButton.classList.remove('bg-blue-600');
          setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.classList.remove('bg-green-600');
            saveButton.classList.add('bg-blue-600');
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      showNotification('Failed to save settings. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.exportCsv();
        if (result.success) {
          showNotification(`Data exported successfully!\n${result.count} trades exported to:\n${result.path}`, 'success');
        } else {
          if (result.error !== 'Export canceled') {
            showNotification(`Export failed: ${result.error}`, 'error');
          }
        }
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      showNotification('Failed to export data. Please try again.', 'error');
    }
  };

  const handleImportData = async () => {
    showConfirm('This will import trades from a CSV file. Duplicate trades may be created. After import, use "Match P&L" to calculate profits/losses. Continue?', async () => {
      try {
        if (window.electronAPI) {
          const result = await window.electronAPI.importCsv();
          if (result.success) {
            let message = `Import completed!\n${result.imported} trades imported successfully`;
            if (result.errors && result.errors > 0) {
              message += `\n${result.errors} errors occurred`;
              if (result.errorDetails && result.errorDetails.length > 0) {
                message += `\n\nFirst few errors:\n${result.errorDetails.slice(0, 3).join('\n')}`;
              }
            }
            message += '\n\nNext step: Click "Match P&L" to calculate profits and losses for your trades.';
            showNotification(message, 'success');
          } else {
            if (result.error !== 'Import canceled') {
              showNotification(`Import failed: ${result.error}`, 'error');
            }
          }
        }
      } catch (error) {
        console.error('Failed to import data:', error);
        showNotification('Failed to import data. Please try again.', 'error');
      }
    });
  };

  const handleBackupDatabase = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.backupDatabase();
        if (result.success) {
          showNotification(`Database backup created successfully!\nSaved to: ${result.path}`, 'success');
        } else {
          if (result.error !== 'Backup canceled') {
            showNotification(`Backup failed: ${result.error}`, 'error');
          }
        }
      }
    } catch (error) {
      console.error('Failed to backup database:', error);
      showNotification('Failed to backup database. Please try again.', 'error');
    }
  };

  const handleRestoreDatabase = async () => {
    showConfirm('This will replace your current database with the backup. All current data will be lost. Are you sure you want to continue?', async () => {
      try {
        if (window.electronAPI) {
          const result = await window.electronAPI.restoreDatabase();
          if (result.success) {
            showNotification(`Database restored successfully from: ${result.path}\n\nThe application will now restart to load the restored data.`, 'success');
            // The main process will handle the database refresh via IPC events
          } else {
            if (result.error !== 'Restore canceled') {
              showNotification(`Restore failed: ${result.error}`, 'error');
            }
          }
        }
      } catch (error) {
        console.error('Failed to restore database:', error);
        showNotification('Failed to restore database. Please try again.', 'error');
      }
    });
  };

  const handleMatchPnL = async () => {
    showConfirm('This will analyze your trades and match buy/sell pairs to calculate P&L. This may take a few moments. Continue?', async () => {
      try {
        if (window.electronAPI) {
          // @ts-ignore - matchPnL method is available in electronAPI
          const result = await window.electronAPI.matchPnL();
          if (result.success) {
            showNotification(`P&L matching completed successfully!\n\nRefresh the page to see updated analytics.`, 'success');
          } else {
            showNotification(`P&L matching failed: ${result.error}`, 'error');
          }
        }
      } catch (error) {
        console.error('Failed to match P&L:', error);
        showNotification('Failed to match P&L. Please try again.', 'error');
      }
    });
  };

    const handlePurgeDatabase = async () => {
    try {
      if (window.electronAPI) {
        // @ts-ignore - purgeDatabase method is available in electronAPI
        const result = await window.electronAPI.purgeDatabase();
        if (result.success) {
          showNotification(`Database purged successfully! All trade data has been permanently deleted.

The application will reload momentarily to refresh all data.`, 'success');
          // The main process will handle the database refresh via IPC events
        } else {
          showNotification(`Purge failed: ${result.error}`, 'error');
        }
      }
    } catch (error) {
      console.error('Failed to purge database:', error);
      showNotification('Failed to purge database. Please try again.', 'error');
    } finally {
      setShowPurgeDialog(false);
    }
  };

  const handleCheckForUpdates = async () => {
    try {
      if (window.electronAPI) {
        // @ts-ignore - checkForUpdates method will be available in electronAPI
        const result = await window.electronAPI.checkForUpdates();
        if (result.hasUpdate) {
          const message = `🎉 Update Available!\n\nCurrent Version: ${result.currentVersion}\nLatest Version: ${result.latestVersion}\n\nNew in ${result.latestVersion}:\n${result.releaseNotes}\n\nWould you like to download the update?`;
          showConfirm(message, () => {
            // Open GitHub releases page in external browser
            // @ts-ignore - openExternal method will be available
            if (window.electronAPI.openExternal && result.downloadUrl) {
              window.electronAPI.openExternal(result.downloadUrl);
            }
          });
        } else {
          showNotification(`✅ You're up to date!\n\nCurrent Version: ${result.currentVersion}\n\nTradingBook is running the latest version.`, 'success');
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      showNotification(`❌ Failed to check for updates.\n\nPlease check your internet connection or visit:\nhttps://github.com/appatalks/TradingBook/releases`, 'error');
    }
  };

  const handleGetDebugStatus = async () => {
    try {
      const status = await window.electronAPI.getDatabaseStatus();
      setDebugStatus(status);
      setShowDebugInfo(true);
    } catch (error) {
      setNotification({
        message: `Error getting debug status: ${error}`,
        type: 'error'
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
      
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-md ${
          notification.type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' :
          notification.type === 'error' ? 'bg-red-100 border border-red-400 text-red-700' :
          'bg-blue-100 border border-blue-400 text-blue-700'
        }`}>
          <div className="flex justify-between items-center">
            <div className="flex-1 whitespace-pre-line">{notification.message}</div>
            <button 
              onClick={() => setNotification(null)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <p className="text-gray-900 dark:text-white mb-6 whitespace-pre-line">{confirmDialog.message}</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading settings...</span>
        </div>
      ) : (
        <>
          {/* General Settings */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">General</h2>
              <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Dark Mode
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Use dark theme throughout the application
                </p>
              </div>
              <button
                onClick={onToggleDarkMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  darkMode ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Debug Mode
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enable console logging for troubleshooting
                </p>
              </div>
              <button
                onClick={async () => {
                  const newDebugMode = !settings.debugMode;
                  setSettings(prev => ({ ...prev, debugMode: newDebugMode }));
                  
                  // Update debug logger in renderer process immediately
                  debugLogger.setEnabled(newDebugMode);
                  
                  // Also sync with main process
                  try {
                    if (window.electronAPI) {
                      await window.electronAPI.setDebugEnabled(newDebugMode);
                    }
                  } catch (error) {
                    console.error('Failed to sync debug mode with main process:', error);
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.debugMode ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.debugMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Commission
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.defaultCommission}
                onChange={(e) => setSettings(prev => ({ ...prev, defaultCommission: e.target.value }))}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Currency
              </label>
              <select
                value={settings.currency}
                onChange={(e) => setSettings(prev => ({ ...prev, currency: e.target.value }))}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Frankfurt">Frankfurt</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Shanghai">Shanghai</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Settings */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Trading</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto-calculate P&L
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatically calculate profit/loss when exit price is entered
                </p>
              </div>
              <button
                onClick={() => setSettings(prev => ({ ...prev, autoCalculatePnL: !prev.autoCalculatePnL }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.autoCalculatePnL ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.autoCalculatePnL ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notifications
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Show desktop notifications for trade updates
                </p>
              </div>
              <button
                onClick={() => setSettings(prev => ({ ...prev, notifications: !prev.notifications }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notifications ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Data Management</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Export Format
              </label>
              <select
                value={settings.exportFormat}
                onChange={(e) => setSettings(prev => ({ ...prev, exportFormat: e.target.value }))}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="CSV">CSV</option>
                <option value="JSON">JSON</option>
                <option value="Excel">Excel</option>
              </select>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleExportData}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Export All Data
              </button>
              <button
                onClick={handleImportData}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Import Data
              </button>
              <button
                onClick={handleMatchPnL}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Match P&L
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Database Info */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Database Information</h2>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>
              <span className="font-medium">Database Location:</span> {databasePath}
              <button
                onClick={loadDatabasePath}
                className="ml-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                title="Refresh database path"
              >
                🔄
              </button>
            </p>
            <p>
              <span className="font-medium">Version:</span> {packageJson.version}
            </p>
            <p>
              <span className="font-medium">Last Backup:</span> Manual backups available below
            </p>
          </div>
          
          <div className="mt-4 flex space-x-3">
            <button
              onClick={handleBackupDatabase}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Create Backup
            </button>
            <button
              onClick={handleRestoreDatabase}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Restore from Backup
            </button>
            <button
              onClick={handleGetDebugStatus}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Debug Status
            </button>
            <button
              onClick={() => setShowPurgeDialog(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Purge Database
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="save-settings-btn px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* About */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">About TradingBook</h2>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>
              <span className="font-medium">Version:</span> {packageJson.version}
            </p>
            <p>
              <span className="font-medium">Build:</span> Electron Desktop App
            </p>
            <p>
              <span className="font-medium">License:</span> MIT
            </p>
            <p>
              <span className="font-medium">Repository:</span>{' '}
              <button
                onClick={() => {
                  // @ts-ignore - openExternal will be available
                  if (window.electronAPI?.openExternal) {
                    window.electronAPI.openExternal('https://github.com/appatalks/TradingBook');
                  }
                }}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer"
              >
                github.com/appatalks/TradingBook
              </button>
            </p>
            <p className="mt-4">
              TradingBook is an open-source trading journal application designed to help traders 
              track, analyze, and improve their trading performance. All your data is stored 
              locally on your machine for maximum privacy and security.
            </p>
          </div>
          
          {/* Check for Updates Button */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={handleCheckForUpdates}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-medium rounded-lg transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Check for Updates
            </button>
          </div>
        </div>
      </div>

      {/* Debug Info Dialog */}
      {showDebugInfo && debugStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Database Debug Status</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Database Status: </span>
                <span className={debugStatus.initialized ? "text-green-600" : "text-red-600"}>
                  {debugStatus.initialized ? "Initialized" : "Not Initialized"}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Database Path: </span>
                <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">{debugStatus.dbPath}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Database Manager: </span>
                <span className={debugStatus.managerLoaded ? "text-green-600" : "text-red-600"}>
                  {debugStatus.managerLoaded ? "Loaded" : "Not Loaded"}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Schema Loaded: </span>
                <span className={debugStatus.schemaLoaded ? "text-green-600" : "text-red-600"}>
                  {debugStatus.schemaLoaded ? "Yes" : "No"}
                </span>
              </div>
              {debugStatus.error && (
                <div>
                  <span className="font-medium text-red-600">Error: </span>
                  <span className="text-red-600 font-mono text-xs">{debugStatus.error}</span>
                </div>
              )}
              {debugStatus.lastInitAttempt && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Last Init Attempt: </span>
                  <span className="text-gray-600 dark:text-gray-400">{new Date(debugStatus.lastInitAttempt).toLocaleString()}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDebugInfo(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Database Warning Dialog */}
      {showPurgeDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Purge Database
                </h3>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                <strong className="text-red-600 dark:text-red-400">WARNING:</strong> This action will permanently delete ALL trade data from your database.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                This includes:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 ml-4 list-disc mb-3">
                <li>All trade records</li>
                <li>All profit/loss history</li>
                <li>All analytics data</li>
                <li>All notes and strategies</li>
              </ul>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                This action cannot be undone. Make sure you have a backup if you want to preserve your data.
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowPurgeDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handlePurgeDatabase}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Yes, Purge Database
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default Settings;
