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
