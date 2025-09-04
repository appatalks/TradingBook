const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  onImportTrades: (callback) => ipcRenderer.on('import-trades', callback),
  onExportData: (callback) => ipcRenderer.on('export-data', callback),
  onToggleTheme: (callback) => ipcRenderer.on('toggle-theme', callback),
  
  // Database operations
  saveTrade: (trade) => ipcRenderer.invoke('save-trade', trade),
  saveTradesBulk: (trades) => ipcRenderer.invoke('save-trades-bulk', trades),
  getTrades: (filters) => ipcRenderer.invoke('get-trades', filters),
  updateTrade: (id, trade) => ipcRenderer.invoke('update-trade', id, trade),
  deleteTrade: (id) => ipcRenderer.invoke('delete-trade', id),
  
  // Analytics
  getPerformanceMetrics: (dateRange) => ipcRenderer.invoke('get-performance-metrics', dateRange),
  getCalendarData: (month, year) => ipcRenderer.invoke('get-calendar-data', month, year),
  
  // Daily notes
  saveDailyNote: (date, notes) => ipcRenderer.invoke('save-daily-note', date, notes),
  getDailyNote: (date) => ipcRenderer.invoke('get-daily-note', date),
  deleteDailyNote: (date) => ipcRenderer.invoke('delete-daily-note', date),
  
  // Settings
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  
  // Backup/Restore
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: () => ipcRenderer.invoke('restore-database'),
  purgeDatabase: () => ipcRenderer.invoke('purge-database'),
  
  // CSV Import/Export
  exportCsv: () => ipcRenderer.invoke('export-csv'),
  importCsv: () => ipcRenderer.invoke('import-csv'),
  
  // Debug Logger
  setDebugEnabled: (enabled) => ipcRenderer.invoke('set-debug-enabled', enabled),
  
  // Database status debugging
  getDatabaseStatus: () => ipcRenderer.invoke('get-database-status'),
  
  // P&L Matching
  matchPnL: () => ipcRenderer.invoke('match-pnl'),
  
  // Update checking
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // System paths
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
  
  // Yahoo Finance API
  fetchStockData: (symbol) => ipcRenderer.invoke('fetch-stock-data', symbol),
  
  // Database refresh events (to avoid window reloads)
  onDatabasePurged: (callback) => ipcRenderer.on('database-purged', callback),
  onDatabaseRestored: (callback) => ipcRenderer.on('database-restored', callback),
  onDatabaseError: (callback) => ipcRenderer.on('database-error', callback),
  
  // Cleanup function for database listeners
  removeDatabaseListeners: () => {
    ipcRenderer.removeAllListeners('database-purged');
    ipcRenderer.removeAllListeners('database-restored');
    ipcRenderer.removeAllListeners('database-error');
  }
});
