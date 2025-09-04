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
      
      // Ensure the userData directory exists
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
        debugLogger.log('Created userData directory:', userDataPath);
      }
      
      this.db = new Database(this.dbPath);
      debugLogger.log('Connected to SQLite database');
      
      // Test database connection
      this.db.prepare('SELECT 1').get();
      debugLogger.log('Database connection test successful');
      
      this.createTables();
    } catch (err) {
      console.error('Error opening database:', err);
      debugLogger.log('Database initialization failed:', err.message);
      throw err;
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
        const stmt = this.db.prepare('DELETE FROM trades WHERE id = ?');
        const result = stmt.run(id);
        resolve({ deleted: result.changes });
      } catch (err) {
        reject(err);
      }
    });
  }

  purgeAllTrades() {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare('DELETE FROM trades');
        const result = stmt.run();
        resolve({ deleted: result.changes });
      } catch (err) {
        reject(err);
      }
    });
  }

  // Analytics methods
  getPerformanceMetrics(dateRange) {
    return new Promise((resolve, reject) => {
      try {
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
          sharpeRatio: 0, // TODO: Implement Sharpe ratio calculation
          maxDrawdown: 0 // TODO: Implement max drawdown calculation
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
      } catch (err) {
        console.error('Error in getPerformanceMetrics:', err);
        reject(err);
      }
    });
  }

  getCalendarData(month, year) {
    return new Promise((resolve, reject) => {
      try {
        const sql = `
          SELECT 
            DATE(entry_date) as date,
            SUM(CASE WHEN pnl IS NOT NULL THEN pnl ELSE 0 END) as daily_pnl,
            COUNT(*) as trade_count,
            SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins
          FROM trades 
          WHERE strftime('%m', entry_date) = ? 
            AND strftime('%Y', entry_date) = ?
          GROUP BY DATE(entry_date)
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
        // Date should be in YYYY-MM-DD format
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO daily_notes (date, notes, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        
        const result = stmt.run(date, notes);
        debugLogger.log('Database saveDailyNote result:', result);
        resolve({ success: true, id: result.lastInsertRowid });
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
        const stmt = this.db.prepare('SELECT * FROM daily_notes WHERE date = ?');
        const note = stmt.get(date);
        debugLogger.log('Database getDailyNote result:', note);
        resolve(note);
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
        const stmt = this.db.prepare('DELETE FROM daily_notes WHERE date = ?');
        const result = stmt.run(date);
        debugLogger.log('Database deleteDailyNote result:', result);
        resolve({ deleted: result.changes });
      } catch (err) {
        console.error('Database deleteDailyNote error:', err);
        debugLogger.log('Database deleteDailyNote error details:', err.message);
        reject(err);
      }
    });
  }

  // Backup/restore utility methods
  getDatabasePath() {
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
      this.db.close();
    }
  }
}

module.exports = DatabaseManager;
