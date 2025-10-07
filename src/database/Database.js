const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Create debug logger directly in the file to avoid path issues
const debugLogger = {
  isEnabled: true,
  setEnabled: function(enabled) {
    this.isEnabled = enabled;
  },
  log: function(...args) {
    if (this.isEnabled) {
      console.log(...args);
    }
  }
};

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.isWindows = process.platform === 'win32';
    this.isNativeSQLite = false;
    this.isMemoryFallback = false;
    this.init();
  }

  // Method to control debug logging from external sources
  setDebugEnabled(enabled) {
    debugLogger.setEnabled(enabled);
  }

  init() {
    try {
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'trades.db');
      
      debugLogger.log('Initializing database at path:', this.dbPath);
      debugLogger.log('Platform:', process.platform);
      debugLogger.log('User data path:', userDataPath);
      
      // Ensure the userData directory exists
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
        debugLogger.log('Created userData directory:', userDataPath);
      }
      
      // Try native SQLite first
      try {
        // For Windows, do some additional checks
        if (process.platform === 'win32') {
          if (fs.existsSync(this.dbPath)) {
            try {
              fs.accessSync(this.dbPath, fs.constants.R_OK | fs.constants.W_OK);
              debugLogger.log('Database file access test passed on Windows');
            } catch (accessError) {
              debugLogger.log('Database file access test failed on Windows:', accessError.message);
              // File may be locked, try to continue anyway
            }
          }
        }
        
        this.db = new Database(this.dbPath);
        debugLogger.log('✅ Connected to native SQLite database');
        
        // Test database connection
        this.db.prepare('SELECT 1').get();
        debugLogger.log('✅ Database connection test successful');
        
        this.createTables();
        this.isNativeSQLite = true;
        this.isMemoryFallback = false;
        debugLogger.log('✅ Native SQLite database ready');
        
      } catch (sqliteError) {
        debugLogger.log('❌ Native SQLite failed:', sqliteError.message);
        
        // If we're on Windows and SQLite fails, fall back to JSON storage
        if (this.isWindows) {
          debugLogger.log('🔄 Falling back to JSON file storage for Windows...');
          this.fallbackToMemoryStorage();
        } else {
          // On Linux, SQLite should work, so throw the error
          throw sqliteError;
        }
      }
      
    } catch (err) {
      console.error('Error opening database:', err);
      debugLogger.log('Database initialization failed:', err.message);
      throw err;
    }
  }
  
  fallbackToMemoryStorage() {
    debugLogger.log('Initializing JSON file-based fallback storage...');
    this.db = null; // No SQLite connection
    this.isNativeSQLite = false;
    this.isMemoryFallback = true;
    
    // Use JSON file for persistent storage
    const userDataPath = app.getPath('userData');
    this.jsonDbPath = path.join(userDataPath, 'trades.json');
    
    // Load existing data or create new
    this.loadJsonDatabase();
    
    debugLogger.log('✅ JSON file-based fallback storage ready');
    debugLogger.log('📁 Database file:', this.jsonDbPath);
    debugLogger.log('✅ Data will persist between app sessions');
  }
  
  loadJsonDatabase() {
    try {
      if (fs.existsSync(this.jsonDbPath)) {
        const data = fs.readFileSync(this.jsonDbPath, 'utf8');
        this.memoryStore = JSON.parse(data);
        debugLogger.log('📖 Loaded existing JSON database with', this.memoryStore.trades?.length || 0, 'trades');
      } else {
        this.memoryStore = {
          trades: [],
          settings: {},
          dailyNotes: {},
          nextId: 1
        };
        debugLogger.log('📝 Created new JSON database');
      }
      
      // Set up convenient references
      this.tradesData = this.memoryStore.trades;
      this.dailyNotesData = this.memoryStore.dailyNotes;
      this.settingsData = this.memoryStore.settings;
      this.nextId = this.memoryStore.nextId;
      
      // Ensure nextId is higher than any existing trade ID
      if (this.tradesData && this.tradesData.length > 0) {
        const maxId = Math.max(...this.tradesData.map(t => t.id || 0));
        this.nextId = Math.max(this.nextId || 1, maxId + 1);
        this.memoryStore.nextId = this.nextId;
      }
      
    } catch (error) {
      console.error('Failed to load JSON database:', error);
      this.memoryStore = {
        trades: [],
        settings: {},
        dailyNotes: {},
        nextId: 1
      };
      this.tradesData = this.memoryStore.trades;
      this.dailyNotesData = this.memoryStore.dailyNotes;
      this.settingsData = this.memoryStore.settings;
      this.nextId = this.memoryStore.nextId;
    }
  }
  
  saveJsonDatabase() {
    try {
      const data = JSON.stringify(this.memoryStore, null, 2);
      fs.writeFileSync(this.jsonDbPath, data, 'utf8');
      debugLogger.log('💾 JSON database saved successfully');
    } catch (error) {
      console.error('Failed to save JSON database:', error);
    }
  }

  createTables() {
    try {
      // Handle schema path for both development and production builds
      let schemaPath;
      const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV;
      
      if (isDev) {
        // Development mode - use relative path
        schemaPath = path.join(__dirname, 'schema.sql');
      } else {
        // Production mode - try multiple possible paths
        const possiblePaths = [
          path.join(__dirname, 'schema.sql'),
          path.join(process.resourcesPath, 'app.asar', 'src', 'database', 'schema.sql'),
          path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'database', 'schema.sql'),
          path.join(__dirname, '..', '..', 'src', 'database', 'schema.sql')
        ];
        
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            schemaPath = testPath;
            break;
          }
        }
        
        if (!schemaPath) {
          // Fallback to embedded schema if file not found
          debugLogger.log('Schema file not found, using embedded schema');
          this.createTablesFromEmbeddedSchema();
          return;
        }
      }
      
      debugLogger.log('Loading schema from:', schemaPath);
      
      if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found at: ${schemaPath}`);
      }
      
      const schema = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(schema);
      debugLogger.log('Database tables created successfully');
    } catch (err) {
      console.error('Error creating tables:', err);
      debugLogger.log('Failed to create tables from file, trying embedded schema');
      this.createTablesFromEmbeddedSchema();
    }
  }

  // Embedded schema as fallback for production builds
  createTablesFromEmbeddedSchema() {
    const embeddedSchema = `
-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL', 'LONG', 'SHORT')),
    quantity REAL NOT NULL,
    entry_price REAL NOT NULL,
    exit_price REAL,
    entry_date TEXT NOT NULL,
    exit_date TEXT,
    pnl REAL,
    commission REAL DEFAULT 0,
    strategy TEXT,
    notes TEXT,
    tags TEXT, -- JSON array of tags
    screenshots TEXT, -- JSON array of screenshot paths
    asset_type TEXT NOT NULL CHECK (asset_type IN ('STOCK', 'OPTION', 'CRYPTO', 'FOREX')),
    option_type TEXT CHECK (option_type IN ('CALL', 'PUT')),
    strike_price REAL,
    expiration_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Strategies table
CREATE TABLE IF NOT EXISTS strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#6B7280',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily notes table for journaling
CREATE TABLE IF NOT EXISTS daily_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD format
    notes TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_entry_date ON trades(entry_date);
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy);
CREATE INDEX IF NOT EXISTS idx_trades_asset_type ON trades(asset_type);
CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON daily_notes(date);

-- Insert default strategies
INSERT OR IGNORE INTO strategies (name, description, color) VALUES
('Momentum', 'Trend following strategy', '#10B981'),
('Mean Reversion', 'Counter-trend strategy', '#EF4444'),
('Breakout', 'Breakout trading strategy', '#8B5CF6'),
('Scalping', 'Quick in and out trades', '#F59E0B');

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
('theme', 'light'),
('default_commission', '0'),
('currency', 'USD'),
('timezone', 'America/New_York');
`;
    
    try {
      this.db.exec(embeddedSchema);
      debugLogger.log('Database tables created successfully from embedded schema');
    } catch (err) {
      console.error('Error creating tables from embedded schema:', err);
      throw err;
    }
  }

  // Trade operations
  saveTrade(trade) {
    return new Promise((resolve, reject) => {
      try {
        // Use JSON file fallback for Windows
        if (this.isWindows) {
          const newTrade = {
            id: this.nextId++,
            ...trade,
            // Ensure dates are stored consistently
            entryDate: trade.entryDate instanceof Date ? trade.entryDate.toISOString() : trade.entryDate,
            exitDate: trade.exitDate instanceof Date ? trade.exitDate.toISOString() : trade.exitDate,
            expirationDate: trade.expirationDate instanceof Date ? trade.expirationDate.toISOString() : trade.expirationDate
          };
          this.tradesData.push(newTrade);
          this.memoryStore.nextId = this.nextId; // Keep memoryStore in sync
          this.saveJsonDatabase(); // Persist to file immediately
          debugLogger.log('💾 Trade saved to JSON database:', newTrade.symbol);
          
          // Return trade with Date objects for frontend compatibility
          const returnTrade = {
            ...newTrade,
            entryDate: newTrade.entryDate ? new Date(newTrade.entryDate) : null,
            exitDate: newTrade.exitDate ? new Date(newTrade.exitDate) : null,
            expirationDate: newTrade.expirationDate ? new Date(newTrade.expirationDate) : null
          };
          resolve(returnTrade);
          return;
        }
        
        // Native SQLite path
        const stmt = this.db.prepare(`
          INSERT INTO trades (
            symbol, side, quantity, entry_price, exit_price, entry_date, exit_date,
            pnl, commission, strategy, notes, tags, screenshots, asset_type,
            option_type, strike_price, expiration_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        // Convert undefined values to null and handle Date objects
        // Store dates without UTC conversion to maintain local timezone accuracy
        const formatDateForStorage = (date) => {
          if (!(date instanceof Date)) return date;
          // Store as YYYY-MM-DDTHH:mm:ss format without Z suffix to avoid timezone confusion
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        };
        
        const result = stmt.run(
          trade.symbol,
          trade.side,
          trade.quantity,
          trade.entryPrice,
          trade.exitPrice ?? null,
          formatDateForStorage(trade.entryDate),
          trade.exitDate ? formatDateForStorage(trade.exitDate) : null,
          trade.pnl ?? null,
          trade.commission ?? 0,
          trade.strategy ?? null,
          trade.notes ?? null,
          JSON.stringify(trade.tags || []),
          JSON.stringify(trade.screenshots || []),
          trade.assetType,
          trade.optionType ?? null,
          trade.strikePrice ?? null,
          trade.expirationDate ? formatDateForStorage(trade.expirationDate) : null
        );
        
        resolve({ id: result.lastInsertRowid, ...trade });
      } catch (err) {
        reject(err);
      }
    });
  }

  getTrades(filters = {}) {
    return new Promise((resolve, reject) => {
      try {
        // Use JSON file fallback for Windows
        if (this.isWindows) {
          let trades = [...this.tradesData];
          debugLogger.log('💾 JSON fallback getTrades - Starting with', trades.length, 'trades');
          debugLogger.log('💾 Filters:', filters);
          
          // Apply filters
          if (filters.symbol) {
            trades = trades.filter(t => t.symbol.toLowerCase().includes(filters.symbol.toLowerCase()));
          }
          if (filters.startDate) {
            const startDate = filters.startDate instanceof Date ? filters.startDate : new Date(filters.startDate);
            debugLogger.log('💾 Filtering by startDate:', startDate.toISOString(), 'from string:', filters.startDate);
            const originalCount = trades.length;
            trades = trades.filter(t => {
              const tradeDate = new Date(t.entryDate);
              // Compare only the date parts (YYYY-MM-DD) by setting time to midnight
              const tradeDateOnly = new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate());
              const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
              const matches = tradeDateOnly >= startDateOnly;
              if (!matches) {
                debugLogger.log('💾 Trade filtered out - tradeDate:', tradeDate.toISOString(), 'vs startDate:', startDate.toISOString());
              }
              return matches;
            });
            debugLogger.log('💾 After startDate filter:', trades.length, 'trades (was', originalCount, ')');
          }
          if (filters.endDate) {
            const endDate = filters.endDate instanceof Date ? filters.endDate : new Date(filters.endDate);
            debugLogger.log('💾 Filtering by endDate:', endDate.toISOString(), 'from string:', filters.endDate);
            const originalCount = trades.length;
            trades = trades.filter(t => {
              const tradeDate = new Date(t.entryDate);
              // Compare only the date parts (YYYY-MM-DD) by setting time to midnight
              const tradeDateOnly = new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate());
              const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
              const matches = tradeDateOnly <= endDateOnly;
              if (!matches) {
                debugLogger.log('💾 Trade filtered out - tradeDate:', tradeDate.toISOString(), 'vs endDate:', endDate.toISOString());
              }
              return matches;
            });
            debugLogger.log('💾 After endDate filter:', trades.length, 'trades (was', originalCount, ')');
          }
          if (filters.strategy) {
            trades = trades.filter(t => t.strategy === filters.strategy);
          }
          if (filters.assetType) {
            trades = trades.filter(t => t.assetType === filters.assetType);
          }
          if (filters.minPnL !== undefined) {
            trades = trades.filter(t => t.pnl !== null && t.pnl >= filters.minPnL);
          }
          if (filters.maxPnL !== undefined) {
            trades = trades.filter(t => t.pnl !== null && t.pnl <= filters.maxPnL);
          }
          
          // Handle specific date filtering (for calendar day clicks)
          if (filters.date) {
            debugLogger.log('🗓️ JSON fallback - Filtering by specific date:', filters.date);
            const filterDate = new Date(filters.date);
            const filterYear = filterDate.getFullYear();
            const filterMonth = filterDate.getMonth();
            const filterDay = filterDate.getDate();
            

            
            trades = trades.filter(trade => {
              const tradeDate = new Date(trade.entryDate);
              const tradeYear = tradeDate.getFullYear();
              const tradeMonth = tradeDate.getMonth();
              const tradeDay = tradeDate.getDate();
              
              const matches = tradeYear === filterYear && tradeMonth === filterMonth && tradeDay === filterDay;
              

              
              return matches;
            });

          }
          
          // Convert date strings to Date objects (same as SQLite path)
          trades = trades.map(trade => ({
            ...trade,
            entryDate: trade.entryDate ? new Date(trade.entryDate) : null,
            exitDate: trade.exitDate ? new Date(trade.exitDate) : null,
            expirationDate: trade.expirationDate ? new Date(trade.expirationDate) : null
          }));
          
          // Sort by entry date descending
          trades.sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));
          
          debugLogger.log('💾 Retrieved', trades.length, 'trades from memory storage');
          resolve(trades);
          return;
        }
        
        // Native SQLite path
        let sql = 'SELECT * FROM trades WHERE 1=1';
        const params = [];

        if (filters.symbol) {
          sql += ' AND symbol LIKE ?';
          params.push(`%${filters.symbol}%`);
        }
        
        if (filters.startDate) {
          sql += ' AND DATE(entry_date) >= DATE(?)';
          const startParam = filters.startDate instanceof Date ? filters.startDate.toISOString() : filters.startDate;
          params.push(startParam);
        }
        if (filters.endDate) {
          sql += ' AND DATE(entry_date) <= DATE(?)';
          const endParam = filters.endDate instanceof Date ? filters.endDate.toISOString() : filters.endDate;
          params.push(endParam);
        }
        
        if (filters.strategy) {
          sql += ' AND strategy = ?';
          params.push(filters.strategy);
        }
        
        if (filters.assetType) {
          sql += ' AND asset_type = ?';
          params.push(filters.assetType);
        }
        
        if (filters.minPnL !== undefined) {
          sql += ' AND pnl >= ?';
          params.push(filters.minPnL);
        }
        
        if (filters.maxPnL !== undefined) {
          sql += ' AND pnl <= ?';
          params.push(filters.maxPnL);
        }

        sql += ' ORDER BY entry_date DESC';
        
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);

        const trades = rows.map(row => {
          // Map snake_case database fields to camelCase JavaScript objects
          const trade = {
            id: row.id,
            symbol: row.symbol,
            side: row.side,
            quantity: row.quantity,
            entryPrice: row.entry_price,
            exitPrice: row.exit_price,
            entryDate: row.entry_date ? new Date(row.entry_date) : null,
            exitDate: row.exit_date ? new Date(row.exit_date) : null,
            pnl: row.pnl,
            commission: row.commission,
            strategy: row.strategy,
            notes: row.notes,
            tags: row.tags ? JSON.parse(row.tags) : [],
            screenshots: row.screenshots ? JSON.parse(row.screenshots) : [],
            assetType: row.asset_type,
            optionType: row.option_type,
            strikePrice: row.strike_price,
            expirationDate: row.expiration_date ? new Date(row.expiration_date) : null
          };
          return trade;
        });

        resolve(trades);
      } catch (err) {
        console.error('Database query error:', err);
        reject(err);
      }
    });
  }

  updateTrade(id, updates) {
    return new Promise((resolve, reject) => {
      try {
        // Use JSON file fallback for Windows
        if (this.isWindows) {
          const tradeIndex = this.tradesData.findIndex(t => t.id === id);
          if (tradeIndex === -1) {
            throw new Error(`Trade with id ${id} not found`);
          }
          
          // Update the trade
          const updatedTrade = { ...this.tradesData[tradeIndex], ...updates };
          // Handle date formatting for storage
          if (updates.entryDate instanceof Date) updatedTrade.entryDate = updates.entryDate.toISOString();
          if (updates.exitDate instanceof Date) updatedTrade.exitDate = updates.exitDate.toISOString();
          if (updates.expirationDate instanceof Date) updatedTrade.expirationDate = updates.expirationDate.toISOString();
          
          this.tradesData[tradeIndex] = updatedTrade;
          this.saveJsonDatabase(); // Persist to file immediately
          debugLogger.log('💾 Trade updated in JSON database:', updatedTrade.symbol);
          
          // Return trade with Date objects for frontend compatibility
          const returnTrade = {
            ...updatedTrade,
            entryDate: updatedTrade.entryDate ? new Date(updatedTrade.entryDate) : null,
            exitDate: updatedTrade.exitDate ? new Date(updatedTrade.exitDate) : null,
            expirationDate: updatedTrade.expirationDate ? new Date(updatedTrade.expirationDate) : null
          };
          resolve(returnTrade);
          return;
        }
        
        // Date formatting helper (same as in saveTrade)
        const formatDateForStorage = (date) => {
          if (!(date instanceof Date)) return date;
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        };
        
        const fields = [];
        const params = [];

        Object.keys(updates).forEach(key => {
          if (key === 'tags' || key === 'screenshots') {
            fields.push(`${key} = ?`);
            params.push(JSON.stringify(updates[key]));
          } else if (key === 'entryDate') {
            fields.push('entry_date = ?');
            params.push(formatDateForStorage(updates[key]));
          } else if (key === 'exitDate') {
            fields.push('exit_date = ?');
            params.push(updates[key] ? formatDateForStorage(updates[key]) : null);
          } else if (key === 'expirationDate') {
            fields.push('expiration_date = ?');
            params.push(updates[key] ? formatDateForStorage(updates[key]) : null);
          } else {
            const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            fields.push(`${dbField} = ?`);
            params.push(updates[key] ?? null);
          }
        });

        params.push(id);
        
        const sql = `UPDATE trades SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        const stmt = this.db.prepare(sql);
        stmt.run(...params);
        
        resolve({ id, ...updates });
      } catch (err) {
        reject(err);
      }
    });
  }

  deleteTrade(id) {
    return new Promise((resolve, reject) => {
      try {
        if (this.isWindows) {
          // Delete from JSON data
          const tradeIndex = this.tradesData.findIndex(trade => trade.id === id);
          if (tradeIndex !== -1) {
            this.tradesData.splice(tradeIndex, 1);
            this.saveJsonDatabase();
            resolve({ deleted: 1 });
          } else {
            resolve({ deleted: 0 });
          }
        } else {
          const stmt = this.db.prepare('DELETE FROM trades WHERE id = ?');
          const result = stmt.run(id);
          resolve({ deleted: result.changes });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  purgeAllTrades() {
    return new Promise((resolve, reject) => {
      try {
        if (this.isWindows) {
          // Clear JSON data
          const deleted = this.tradesData.length;
          this.tradesData = [];
          this.nextId = 1;
          this.saveJsonDatabase();
          resolve({ deleted: deleted });
        } else {
          const stmt = this.db.prepare('DELETE FROM trades');
          const result = stmt.run();
          resolve({ deleted: result.changes });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  // Analytics methods
  getPerformanceMetrics(dateRange) {
    return new Promise((resolve, reject) => {
      try {
        if (this.isWindows) {
          // Calculate metrics from JSON data
          let trades = this.tradesData.filter(trade => trade.pnl !== null && trade.pnl !== undefined);
          
          // Apply date filters
          if (dateRange.startDate || dateRange.endDate) {
            trades = trades.filter(trade => {
              const entryDate = new Date(trade.entryDate);
              // Compare only the date parts (YYYY-MM-DD) by setting time to midnight
              const entryDateOnly = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
              
              if (dateRange.startDate) {
                const startDate = dateRange.startDate instanceof Date 
                  ? dateRange.startDate 
                  : new Date(dateRange.startDate);
                const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                if (entryDateOnly < startDateOnly) return false;
              }
              if (dateRange.endDate) {
                const endDate = dateRange.endDate instanceof Date 
                  ? dateRange.endDate 
                  : new Date(dateRange.endDate);
                const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
                if (entryDateOnly > endDateOnly) return false;
              }
              return true;
            });
          }
          
          const totalTrades = trades.length;
          const winningTrades = trades.filter(t => t.pnl > 0).length;
          const losingTrades = trades.filter(t => t.pnl < 0).length;
          const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
          
          const winners = trades.filter(t => t.pnl > 0);
          const losers = trades.filter(t => t.pnl < 0);
          
          const avgWin = winners.length > 0 ? winners.reduce((sum, t) => sum + t.pnl, 0) / winners.length : 0;
          const avgLoss = losers.length > 0 ? losers.reduce((sum, t) => sum + t.pnl, 0) / losers.length : 0;
          
          const largestWin = winners.length > 0 ? Math.max(...winners.map(t => t.pnl)) : 0;
          const largestLoss = losers.length > 0 ? Math.min(...losers.map(t => t.pnl)) : 0;
          
          // Calculate Sharpe Ratio (annualized)
          let sharpeRatio = 0;
          if (trades.length > 1) {
            const returns = trades.map(t => t.pnl);
            const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
            const stdDev = Math.sqrt(variance);
            if (stdDev > 0) {
              // Assuming ~252 trading days per year for annualization
              sharpeRatio = (avgReturn / stdDev) * Math.sqrt(252);
            }
          }
          
          // Calculate Max Drawdown
          let maxDrawdown = 0;
          let peak = 0;
          let cumulative = 0;
          
          // Sort trades by date for cumulative calculation
          const sortedTrades = [...trades].sort((a, b) => 
            new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
          );
          
          sortedTrades.forEach(trade => {
            cumulative += trade.pnl;
            if (cumulative > peak) {
              peak = cumulative;
            }
            const drawdown = peak > 0 ? ((peak - cumulative) / peak) * 100 : 0;
            if (drawdown > maxDrawdown) {
              maxDrawdown = drawdown;
            }
          });

          const metrics = {
            totalTrades: totalTrades,
            winningTrades: winningTrades,
            losingTrades: losingTrades,
            winRate: totalTrades > 0 ? winningTrades / totalTrades : 0,
            totalPnL: totalPnL,
            averageWin: avgWin,
            averageLoss: avgLoss,
            profitFactor: (avgLoss < 0) ? Math.abs(avgWin / avgLoss) : 0,
            largestWin: largestWin,
            largestLoss: largestLoss,
            sharpeRatio: sharpeRatio,
            maxDrawdown: maxDrawdown,
            topWinners: winners.sort((a, b) => b.pnl - a.pnl).slice(0, 10).map(trade => ({
              ...trade,
              entryDate: trade.entryDate ? new Date(trade.entryDate) : null,
              exitDate: trade.exitDate ? new Date(trade.exitDate) : null,
              expirationDate: trade.expirationDate ? new Date(trade.expirationDate) : null
            })),
            topLosers: losers.sort((a, b) => a.pnl - b.pnl).slice(0, 10).map(trade => ({
              ...trade,
              entryDate: trade.entryDate ? new Date(trade.entryDate) : null,
              exitDate: trade.exitDate ? new Date(trade.exitDate) : null,
              expirationDate: trade.expirationDate ? new Date(trade.expirationDate) : null
            }))
          };
          
          resolve(metrics);
        } else {
          let sql = `
            SELECT 
              COUNT(*) as total_trades,
              SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
              SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
              SUM(pnl) as total_pnl,
              AVG(CASE WHEN pnl > 0 THEN pnl ELSE NULL END) as avg_win,
              AVG(CASE WHEN pnl < 0 THEN pnl ELSE NULL END) as avg_loss,
              MAX(pnl) as largest_win,
              MIN(pnl) as largest_loss
            FROM trades 
            WHERE pnl IS NOT NULL
          `;
          
          const params = [];
          if (dateRange.startDate) {
            sql += ' AND DATE(entry_date) >= DATE(?)';
            // Convert Date object to ISO string if needed
            const startDate = dateRange.startDate instanceof Date 
              ? dateRange.startDate.toISOString() 
              : dateRange.startDate;
            params.push(startDate);
          }
          if (dateRange.endDate) {
            sql += ' AND DATE(entry_date) <= DATE(?)';
            // Convert Date object to ISO string if needed
            const endDate = dateRange.endDate instanceof Date 
              ? dateRange.endDate.toISOString() 
              : dateRange.endDate;
            params.push(endDate);
          }

          const stmt = this.db.prepare(sql);
          const row = stmt.get(...params);
          
          // Get all trades for Sharpe ratio and drawdown calculations
          let allTradesQuery = 'SELECT pnl, entry_date FROM trades WHERE pnl IS NOT NULL';
          if (dateRange.startDate) {
            allTradesQuery += ' AND DATE(entry_date) >= DATE(?)';
          }
          if (dateRange.endDate) {
            allTradesQuery += ' AND DATE(entry_date) <= DATE(?)';
          }
          allTradesQuery += ' ORDER BY entry_date ASC';
          
          const allTradesStmt = this.db.prepare(allTradesQuery);
          const allTrades = allTradesStmt.all(...params);
          
          // Calculate Sharpe Ratio (annualized)
          let sharpeRatio = 0;
          if (allTrades.length > 1) {
            const returns = allTrades.map(t => t.pnl);
            const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
            const stdDev = Math.sqrt(variance);
            if (stdDev > 0) {
              // Assuming ~252 trading days per year for annualization
              sharpeRatio = (avgReturn / stdDev) * Math.sqrt(252);
            }
          }
          
          // Calculate Max Drawdown
          let maxDrawdown = 0;
          let peak = 0;
          let cumulative = 0;
          
          allTrades.forEach(trade => {
            cumulative += trade.pnl;
            if (cumulative > peak) {
              peak = cumulative;
            }
            const drawdown = peak > 0 ? ((peak - cumulative) / peak) * 100 : 0;
            if (drawdown > maxDrawdown) {
              maxDrawdown = drawdown;
            }
          });

          const metrics = {
            totalTrades: row.total_trades || 0,
            winningTrades: row.winning_trades || 0,
            losingTrades: row.losing_trades || 0,
            winRate: row.total_trades ? (row.winning_trades || 0) / row.total_trades : 0,
            totalPnL: row.total_pnl || 0,
            averageWin: row.avg_win || 0,
            averageLoss: row.avg_loss || 0,
            profitFactor: (row.avg_loss && row.avg_loss < 0) ? 
              Math.abs((row.avg_win || 0) / row.avg_loss) : 0,
            largestWin: row.largest_win || 0,
            largestLoss: row.largest_loss || 0,
            sharpeRatio: sharpeRatio,
            maxDrawdown: maxDrawdown
          };
          
          // Add top 10 winners and losers
          try {
            const topWinnersStmt = this.db.prepare(`
              SELECT symbol, quantity, entry_price, exit_price, pnl, entry_date, exit_date 
              FROM trades 
              WHERE pnl IS NOT NULL AND pnl > 0
              ${dateRange.startDate ? 'AND DATE(entry_date) >= DATE(?)' : ''}
              ${dateRange.endDate ? 'AND DATE(entry_date) <= DATE(?)' : ''}
              ORDER BY pnl DESC 
              LIMIT 10
            `);
            
            const topLosersStmt = this.db.prepare(`
              SELECT symbol, quantity, entry_price, exit_price, pnl, entry_date, exit_date 
              FROM trades 
              WHERE pnl IS NOT NULL AND pnl < 0
              ${dateRange.startDate ? 'AND DATE(entry_date) >= DATE(?)' : ''}
              ${dateRange.endDate ? 'AND DATE(entry_date) <= DATE(?)' : ''}
              ORDER BY pnl ASC 
              LIMIT 10
            `);
            
            metrics.topWinners = topWinnersStmt.all(...params);
            metrics.topLosers = topLosersStmt.all(...params);
          } catch (topError) {
            console.error('Error getting top winners/losers:', topError);
            metrics.topWinners = [];
            metrics.topLosers = [];
          }
          
          resolve(metrics);
        }
      } catch (err) {
        console.error('Error in getPerformanceMetrics:', err);
        reject(err);
      }
    });
  }

  getCalendarData(month, year) {
    return new Promise((resolve, reject) => {
      try {
        if (this.isWindows) {
          // Calculate calendar data from JSON data
          const targetMonth = month + 1; // month is 0-based
          const targetYear = year;
          
          // Group trades by date
          const dailyData = {};
          
          this.tradesData.forEach(trade => {
            // Use exitDate if available (when P&L was realized), otherwise use entryDate
            const pnlDate = trade.exitDate || trade.entryDate;
            const tradeDate = new Date(pnlDate);
            if (tradeDate.getFullYear() === targetYear && tradeDate.getMonth() + 1 === targetMonth) {
              // Use toLocaleDateString('en-CA') to get YYYY-MM-DD in local timezone (avoid UTC shift)
              const dateKey = tradeDate.toLocaleDateString('en-CA');
              
              // Debug logging for large losses
              if (trade.pnl && trade.pnl < -700) {
                console.log('Database.js Calendar Debug:', {
                  symbol: trade.symbol,
                  pnl: trade.pnl,
                  exitDate: trade.exitDate,
                  entryDate: trade.entryDate,
                  pnlDate: pnlDate,
                  parsedDate: tradeDate.toString(),
                  dateKey: dateKey
                });
              }
              
              if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                  pnl: 0,
                  tradeCount: 0,
                  wins: 0
                };
              }
              
              dailyData[dateKey].pnl += trade.pnl || 0;
              dailyData[dateKey].tradeCount += 1;
              if (trade.pnl > 0) {
                dailyData[dateKey].wins += 1;
              }
            }
          });
          
          // Convert to array format
          const calendarData = Object.keys(dailyData)
            .sort()
            .map(dateKey => ({
              date: new Date(dateKey + 'T00:00:00'),
              pnl: dailyData[dateKey].pnl,
              tradeCount: dailyData[dateKey].tradeCount,
              winRate: dailyData[dateKey].tradeCount ? dailyData[dateKey].wins / dailyData[dateKey].tradeCount : 0
            }));
          
          resolve(calendarData);
        } else {
          const sql = `
            SELECT 
              DATE(COALESCE(exit_date, entry_date)) as date,
              SUM(CASE WHEN pnl IS NOT NULL THEN pnl ELSE 0 END) as daily_pnl,
              COUNT(*) as trade_count,
              SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins
            FROM trades 
            WHERE strftime('%m', COALESCE(exit_date, entry_date)) = ? 
              AND strftime('%Y', COALESCE(exit_date, entry_date)) = ?
            GROUP BY DATE(COALESCE(exit_date, entry_date))
            ORDER BY date
          `;

          const stmt = this.db.prepare(sql);
          const rows = stmt.all(
            (month + 1).toString().padStart(2, '0'),
            year.toString()
          );
          
          const calendarData = rows.map(row => ({
            // Use timezone-safe date parsing - append 'T00:00:00' to treat as local date
            date: new Date(row.date + 'T00:00:00'),
            pnl: row.daily_pnl,
            tradeCount: row.trade_count,
            winRate: row.trade_count ? row.wins / row.trade_count : 0
          }));
          
          resolve(calendarData);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  // Daily notes operations
  saveDailyNote(date, notes) {
    return new Promise((resolve, reject) => {
      try {
        debugLogger.log('Database saveDailyNote called with date:', date, 'notes length:', notes.length);
        
        if (this.isWindows) {
          // Save daily note in JSON data
          if (!this.dailyNotesData) {
            this.dailyNotesData = {};
          }
          
          this.dailyNotesData[date] = {
            date: date,
            notes: notes,
            updated_at: new Date().toISOString()
          };
          
          this.saveJsonDatabase();
          debugLogger.log('Database saveDailyNote JSON result: success');
          resolve({ success: true, id: date });
        } else {
          // Date should be in YYYY-MM-DD format
          const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO daily_notes (date, notes, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
          `);
          
          const result = stmt.run(date, notes);
          debugLogger.log('Database saveDailyNote result:', result);
          resolve({ success: true, id: result.lastInsertRowid });
        }
      } catch (err) {
        console.error('Database saveDailyNote error:', err);
        debugLogger.log('Database saveDailyNote error details:', err.message);
        reject(err);
      }
    });
  }

  getDailyNote(date) {
    return new Promise((resolve, reject) => {
      try {
        debugLogger.log('Database getDailyNote called with date:', date);
        
        if (this.isWindows) {
          // Get daily note from JSON data
          const note = this.dailyNotesData && this.dailyNotesData[date] ? this.dailyNotesData[date] : null;
          debugLogger.log('Database getDailyNote JSON result:', note);
          resolve(note);
        } else {
          const stmt = this.db.prepare('SELECT * FROM daily_notes WHERE date = ?');
          const note = stmt.get(date);
          debugLogger.log('Database getDailyNote result:', note);
          resolve(note);
        }
      } catch (err) {
        console.error('Database getDailyNote error:', err);
        debugLogger.log('Database getDailyNote error details:', err.message);
        reject(err);
      }
    });
  }

  deleteDailyNote(date) {
    return new Promise((resolve, reject) => {
      try {
        debugLogger.log('Database deleteDailyNote called with date:', date);
        
        if (this.isWindows) {
          // Delete daily note from JSON data
          let deleted = 0;
          if (this.dailyNotesData && this.dailyNotesData[date]) {
            delete this.dailyNotesData[date];
            deleted = 1;
            this.saveJsonDatabase();
          }
          debugLogger.log('Database deleteDailyNote JSON result: deleted', deleted);
          resolve({ deleted: deleted });
        } else {
          const stmt = this.db.prepare('DELETE FROM daily_notes WHERE date = ?');
          const result = stmt.run(date);
          debugLogger.log('Database deleteDailyNote result:', result);
          resolve({ deleted: result.changes });
        }
      } catch (err) {
        console.error('Database deleteDailyNote error:', err);
        debugLogger.log('Database deleteDailyNote error details:', err.message);
        reject(err);
      }
    });
  }

  // Backup/restore utility methods
  getDatabasePath() {
    if (this.isMemoryFallback && this.jsonDbPath) {
      return this.jsonDbPath;
    }
    return this.dbPath;
  }

  checkpoint() {
    // Force SQLite to write all pending changes to disk
    if (this.db) {
      this.db.exec('PRAGMA wal_checkpoint(FULL);');
    }
  }

  close() {
    if (this.db) {
      try {
        // Force WAL checkpoint before closing on all platforms
        this.db.exec('PRAGMA wal_checkpoint(FULL);');
        debugLogger.log('WAL checkpoint completed before closing');
      } catch (walError) {
        debugLogger.log('WAL checkpoint failed before closing:', walError.message);
      }
      
      try {
        this.db.close();
        debugLogger.log('Database connection closed successfully');
      } catch (closeError) {
        console.error('Error closing database:', closeError);
        debugLogger.log('Database close error:', closeError.message);
      } finally {
        this.db = null;
      }
    }
  }
}

module.exports = DatabaseManager;
