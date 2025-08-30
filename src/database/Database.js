const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.init();
  }

  init() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'trades.db');
    
    try {
      this.db = new Database(this.dbPath);
      console.log('Connected to SQLite database');
      this.createTables();
    } catch (err) {
      console.error('Error opening database:', err);
    }
  }

  createTables() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    try {
      this.db.exec(schema);
      console.log('Database tables created successfully');
    } catch (err) {
      console.error('Error creating tables:', err);
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
        const result = stmt.run(
          trade.symbol,
          trade.side,
          trade.quantity,
          trade.entryPrice,
          trade.exitPrice ?? null,
          trade.entryDate instanceof Date ? trade.entryDate.toISOString() : trade.entryDate,
          trade.exitDate instanceof Date ? trade.exitDate.toISOString() : (trade.exitDate ?? null),
          trade.pnl ?? null,
          trade.commission ?? 0,
          trade.strategy ?? null,
          trade.notes ?? null,
          JSON.stringify(trade.tags || []),
          JSON.stringify(trade.screenshots || []),
          trade.assetType,
          trade.optionType ?? null,
          trade.strikePrice ?? null,
          trade.expirationDate instanceof Date ? trade.expirationDate.toISOString() : (trade.expirationDate ?? null)
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
        const fields = [];
        const params = [];

        Object.keys(updates).forEach(key => {
          if (key === 'tags' || key === 'screenshots') {
            fields.push(`${key} = ?`);
            params.push(JSON.stringify(updates[key]));
          } else if (key === 'entryDate') {
            fields.push('entry_date = ?');
            params.push(updates[key] instanceof Date ? updates[key].toISOString() : updates[key]);
          } else if (key === 'exitDate') {
            fields.push('exit_date = ?');
            params.push(updates[key] instanceof Date ? updates[key].toISOString() : (updates[key] ?? null));
          } else if (key === 'expirationDate') {
            fields.push('expiration_date = ?');
            params.push(updates[key] instanceof Date ? updates[key].toISOString() : (updates[key] ?? null));
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
          sql += ' AND entry_date >= ?';
          // Convert Date object to ISO string if needed
          const startDate = dateRange.startDate instanceof Date 
            ? dateRange.startDate.toISOString() 
            : dateRange.startDate;
          params.push(startDate);
        }
        if (dateRange.endDate) {
          sql += ' AND entry_date <= ?';
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
        
        resolve(metrics);
      } catch (err) {
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
