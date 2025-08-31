const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  onImportTrades: (callback) => ipcRenderer.on('import-trades', callback),
  onExportData: (callback) => ipcRenderer.on('export-data', callback),
  onToggleTheme: (callback) => ipcRenderer.on('toggle-theme', callback),
  
  // Database operations
  saveTrade: (trade) => ipcRenderer.invoke('save-trade', trade),
  getTrades: (filters) => ipcRenderer.invoke('get-trades', filters),
  updateTrade: (id, trade) => ipcRenderer.invoke('update-trade', id, trade),
  deleteTrade: (id) => ipcRenderer.invoke('delete-trade', id),
  
  // Analytics
  getPerformanceMetrics: (dateRange) => ipcRenderer.invoke('get-performance-metrics', dateRange),
  getCalendarData: (month, year) => ipcRenderer.invoke('get-calendar-data', month, year),
  
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
  
  // P&L Matching
  matchPnL: () => ipcRenderer.invoke('match-pnl'),
  
  // Update checking
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Yahoo Finance API
  fetchStockData: (symbol) => ipcRenderer.invoke('fetch-stock-data', symbol)
});
