export interface Trade {
  id?: number;
  symbol: string;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  entryDate: Date;
  exitDate?: Date;
  pnl?: number;
  commission: number;
  strategy?: string;
  notes?: string;
  tags?: string[];
  screenshots?: string[];
  assetType: 'STOCK' | 'OPTION' | 'CRYPTO' | 'FOREX';
  // Options specific
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
  expirationDate?: Date;
}

export interface TradeFilter {
  startDate?: Date | string;
  endDate?: Date | string;
  symbol?: string;
  strategy?: string;
  assetType?: string;
  minPnL?: number;
  maxPnL?: number;
  tags?: string[];
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  largestWin: number;
  largestLoss: number;
}

export interface CalendarDay {
  date: Date;
  pnl: number;
  tradeCount: number;
  winRate: number;
}

export interface Strategy {
  id?: number;
  name: string;
  description?: string;
  color?: string;
}

export interface Tag {
  id?: number;
  name: string;
  color?: string;
}

declare global {
  interface Window {
    electronAPI: {
      // File operations
      onImportTrades: (callback: (event: any, filePath: string) => void) => void;
      onExportData: (callback: (event: any) => void) => void;
      onToggleTheme: (callback: (event: any) => void) => void;
      
      // Database operations
      saveTrade: (trade: Omit<Trade, 'id'>) => Promise<Trade>;
      getTrades: (filters: TradeFilter) => Promise<Trade[]>;
      updateTrade: (id: number, trade: Partial<Trade>) => Promise<Trade>;
      deleteTrade: (id: number) => Promise<{ deleted: number }>;
      
      // Analytics
      getPerformanceMetrics: (dateRange: { startDate?: Date; endDate?: Date }) => Promise<PerformanceMetrics>;
      getCalendarData: (month: number, year: number) => Promise<CalendarDay[]>;
      
      // Settings
      saveSettings: (settings: any) => Promise<{ success: boolean }>;
      loadSettings: () => Promise<any>;
      
      // Backup/Restore
      backupDatabase: () => Promise<{ success: boolean; path?: string; error?: string }>;
      restoreDatabase: () => Promise<{ success: boolean; path?: string; error?: string }>;
      
      // CSV Import/Export
      exportCsv: () => Promise<{ success: boolean; path?: string; count?: number; error?: string }>;
      importCsv: () => Promise<{ success: boolean; path?: string; imported?: number; errors?: number; errorDetails?: string[]; error?: string }>;
      
      // P&L Matching
      matchPnL: () => Promise<{ success: boolean; message?: string; error?: string }>;
      
      // Update checking
      checkForUpdates: () => Promise<{ 
        hasUpdate: boolean; 
        currentVersion: string; 
        latestVersion?: string; 
        releaseNotes?: string; 
        downloadUrl?: string; 
      }>;
      
      // External links
      openExternal: (url: string) => Promise<void>;
      
      // Debug logging
      setDebugEnabled: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
      
      // Yahoo Finance API
      fetchStockData: (symbol: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    };
  }
}
