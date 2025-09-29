const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');
const http = require('http');
const url = require('url');

// Handle database require path for both dev and production
let DatabaseManager;
try {
  // Try the relative path first (works in development)
  DatabaseManager = require('../src/database/Database');
} catch (error) {
  try {
    // Try absolute path for production builds
    const databasePath = isDev 
      ? path.join(__dirname, '../src/database/Database')
      : path.join(process.resourcesPath, 'app.asar', 'src/database/Database');
    DatabaseManager = require(databasePath);
  } catch (fallbackError) {
    console.error('Failed to load DatabaseManager:', error.message, fallbackError.message);
    // Last resort: try from app resources
    try {
      DatabaseManager = require(path.join(__dirname, '..', 'src', 'database', 'Database'));
    } catch (lastError) {
      console.error('All DatabaseManager require attempts failed:', lastError.message);
    }
  }
}

// Create debug logger directly to avoid import path issues
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

let mainWindow;
let db;
let localServer;

// Simple HTTP server for serving static files in production
function createLocalServer(buildPath) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let filePath;
      
      // Parse the URL to get the pathname
      const urlPath = url.parse(req.url).pathname;
      
      if (urlPath === '/') {
        // Serve index.html from the ASAR archive
        filePath = path.join(buildPath, 'index.html');
      } else {
        // For static assets (CSS, JS), check if we need unpacked path
        const requestedFile = path.join(buildPath, urlPath.substring(1));
        
        // If we're in an ASAR archive, serve certain files from unpacked directory
        if (buildPath.includes('app.asar') && 
           (urlPath.includes('/static/') || 
            urlPath.includes('.css') || 
            urlPath.includes('.js') ||
            urlPath === '/manifest.json' ||
            urlPath === '/favicon.ico' ||
            urlPath === '/asset-manifest.json')) {
          const unpackedPath = buildPath.replace('/app.asar/', '/app.asar.unpacked/');
          filePath = path.join(unpackedPath, urlPath.substring(1));
        } else {
          filePath = requestedFile;
        }
      }

      // Check if file exists and serve it
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File not found');
          return;
        }

        // Set content type based on file extension
        let contentType = 'text/plain';
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
          case '.html':
            contentType = 'text/html';
            break;
          case '.css':
            contentType = 'text/css';
            break;
          case '.js':
            contentType = 'application/javascript';
            break;
          case '.json':
            contentType = 'application/json';
            break;
          case '.png':
            contentType = 'image/png';
            break;
          case '.jpg':
          case '.jpeg':
            contentType = 'image/jpeg';
            break;
          case '.ico':
            contentType = 'image/x-icon';
            break;
        }

        // Read and serve the file
        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal server error');
            return;
          }

          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        });
      });
    });

    // Start server on a random available port
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      debugLogger.log(`Local HTTP server started on http://localhost:${port}`);
      resolve({ server, port });
    });

    server.on('error', reject);
  });
}

// Settings management
function getSettingsPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'settings.json');
}

function getDefaultSettings() {
  return {
    defaultCommission: '0.00',
    currency: 'USD',
    timezone: 'America/New_York',
    notifications: true,
    autoCalculatePnL: true,
    exportFormat: 'CSV',
    darkMode: false,
    debugMode: true // Enable debug logging by default for troubleshooting
  };
}

async function createWindow() {
  // Get screen dimensions for better initial sizing
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // Try to load saved window bounds, otherwise use calculated optimal size
  let windowBounds = {
    width: Math.floor(Math.max(1450, Math.min(screenWidth * 0.85, 1800))),
    height: Math.floor(Math.max(1000, Math.min(screenHeight * 0.85, 1200)))
  };
  
  // Simplified settings loading to avoid async issues
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      if (settings && settings.windowBounds) {
        const saved = settings.windowBounds;
        // Validate saved bounds are numeric and reasonable
        if (typeof saved.width === 'number' && typeof saved.height === 'number' &&
            saved.width >= 1400 && saved.height >= 950 && 
            saved.width <= screenWidth && saved.height <= screenHeight &&
            saved.width > 0 && saved.height > 0) {
          windowBounds = {
            width: Math.floor(saved.width),
            height: Math.floor(saved.height)
          };
          debugLogger.log('Loaded saved window bounds:', windowBounds);
        } else {
          debugLogger.log('Saved window bounds invalid, using defaults:', saved);
        }
      }
    }
  } catch (error) {
    debugLogger.log('Could not load saved window bounds, using defaults:', error.message);
  }
  
  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    minWidth: 1400,
    minHeight: 950,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true, // Allow loading local resources
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: ['--js-flags=--expose-gc'] // Enable garbage collection access
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
    center: true, // Center the window on screen
    title: 'TradingBook - Trading Journal',
    titleBarStyle: 'default',
    autoHideMenuBar: false // Show menu bar for better UX
  });

  let startUrl;
  
  if (isDev) {
    startUrl = 'http://localhost:3000';
  } else {
    // In production, create a local HTTP server to serve static files
    const buildPath = __dirname;
    const { server, port } = await createLocalServer(buildPath);
    localServer = server;
    startUrl = `http://localhost:${port}`;
  }
  
  debugLogger.log('isDev:', isDev);
  debugLogger.log('__dirname:', __dirname);
  debugLogger.log('Loading URL:', startUrl);

  // Listen to console messages from renderer process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    debugLogger.log(`[RENDERER ${level}]:`, message);
    if (sourceId) debugLogger.log(`  Source: ${sourceId}:${line}`);
  });

  // Listen for errors
  mainWindow.webContents.on('crashed', (event, killed) => {
    debugLogger.log('Renderer process crashed:', killed);
  });

  mainWindow.webContents.on('unresponsive', () => {
    debugLogger.log('Renderer process became unresponsive');
  });

  mainWindow.loadURL(startUrl);

  // Open DevTools in development or for debugging
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Ensure proper window sizing after content loads
    setTimeout(() => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          // Get current content bounds and ensure window is sized appropriately
          const currentBounds = mainWindow.getBounds();
          const contentSize = mainWindow.getContentSize();
          
          // Validate that we got valid values
          if (!contentSize || contentSize.length < 2 || 
              typeof contentSize[0] !== 'number' || typeof contentSize[1] !== 'number') {
            debugLogger.log('Invalid content size detected, skipping resize');
            return;
          }
          
          // If window is too small for dashboard content, resize it
          if (contentSize[0] < 1400 || contentSize[1] < 900) {
            const { screen } = require('electron');
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
            
            const optimalWidth = Math.max(1450, Math.min(screenWidth * 0.85, 1800));
            const optimalHeight = Math.max(1000, Math.min(screenHeight * 0.85, 1200));
            
            // Validate calculated values before setting
            if (optimalWidth > 0 && optimalHeight > 0) {
              mainWindow.setSize(Math.floor(optimalWidth), Math.floor(optimalHeight));
              mainWindow.center();
              debugLogger.log(`Window resized to optimal size: ${optimalWidth}x${optimalHeight}`);
            }
          }
        }
      } catch (error) {
        debugLogger.log('Error in window sizing timeout:', error.message);
      }
    }, 1000);
    
    // Simple check after a delay
    setTimeout(() => {
      debugLogger.log('Checking React mount status...');
      mainWindow.webContents.executeJavaScript('document.getElementById("root").innerHTML.length').then(length => {
        debugLogger.log('React root content length:', length);
        if (length > 0) {
          debugLogger.log('SUCCESS: React app mounted successfully!');
        } else {
          debugLogger.log('ERROR: React app failed to mount - opening DevTools for debugging');
          mainWindow.webContents.openDevTools();
        }
      }).catch(err => {
        debugLogger.log('Error checking React mount:', err.message);
      });
    }, 5000);
  });

  // Add DOM content loaded handler for additional sizing verification
  mainWindow.webContents.on('dom-ready', () => {
    debugLogger.log('DOM ready - verifying window size...');
    
    // Check if we need to adjust window size for content
    setTimeout(() => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const contentSize = mainWindow.getContentSize();
          
          // Validate content size before processing
          if (!contentSize || contentSize.length < 2 || 
              typeof contentSize[0] !== 'number' || typeof contentSize[1] !== 'number') {
            debugLogger.log('Invalid content size in DOM ready handler');
            return;
          }
          
          debugLogger.log(`Current content size: ${contentSize[0]}x${contentSize[1]}`);
          
          // If content area is still too small, force resize
          if (contentSize[0] < 1380 || contentSize[1] < 880) {
            const { screen } = require('electron');
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
            
            const newWidth = Math.max(1450, Math.min(screenWidth * 0.85, 1800));
            const newHeight = Math.max(1000, Math.min(screenHeight * 0.85, 1200));
            
            // Validate calculated values
            if (newWidth > 0 && newHeight > 0) {
              mainWindow.setSize(Math.floor(newWidth), Math.floor(newHeight));
              mainWindow.center();
              debugLogger.log(`Forced window resize after DOM ready: ${newWidth}x${newHeight}`);
            }
          }
        }
      } catch (error) {
        debugLogger.log('Error in DOM ready timeout:', error.message);
      }
    }, 500);
  });

  // Prevent navigation to external URLs only
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Only prevent navigation to external protocols (http, https, etc.)
    // React Router with MemoryRouter shouldn't trigger this event
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      event.preventDefault();
      debugLogger.log('Prevented external navigation to:', navigationUrl);
    }
  });

  // Handle new window requests (prevent opening external links)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Save window bounds when resized or moved (simplified version with safety checks)
  let saveWindowBoundsTimeout;
  const saveWindowBounds = () => {
    if (saveWindowBoundsTimeout) clearTimeout(saveWindowBoundsTimeout);
    saveWindowBoundsTimeout = setTimeout(() => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const bounds = mainWindow.getBounds();
          
          // Validate bounds object has required numeric properties
          if (!bounds || typeof bounds.width !== 'number' || typeof bounds.height !== 'number' ||
              bounds.width <= 0 || bounds.height <= 0) {
            debugLogger.log('Invalid bounds detected, skipping save:', bounds);
            return;
          }
          
          const settingsPath = getSettingsPath();
          let currentSettings = getDefaultSettings();
          
          // Load existing settings if available
          if (fs.existsSync(settingsPath)) {
            const settingsData = fs.readFileSync(settingsPath, 'utf8');
            currentSettings = { ...currentSettings, ...JSON.parse(settingsData) };
          }
          
          // Update with new window bounds (ensure integer values)
          const updatedSettings = { 
            ...currentSettings, 
            windowBounds: { 
              width: Math.floor(bounds.width), 
              height: Math.floor(bounds.height) 
            } 
          };
          
          // Save settings
          const settingsDir = path.dirname(settingsPath);
          if (!fs.existsSync(settingsDir)) {
            fs.mkdirSync(settingsDir, { recursive: true });
          }
          fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2), 'utf8');
          debugLogger.log('Window bounds saved successfully:', { width: bounds.width, height: bounds.height });
        }
      } catch (error) {
        debugLogger.log('Error saving window bounds:', error.message);
      }
    }, 1000); // Debounce saves by 1 second
  };

  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);

  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Dark Mode',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            mainWindow.webContents.send('toggle-theme');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Initialize database
function initDatabase() {
  try {
    debugLogger.log('Starting database initialization...');
    
    if (!DatabaseManager) {
      throw new Error('DatabaseManager class not loaded - check require path');
    }
    
    db = new DatabaseManager();
    debugLogger.log('Database initialized successfully');
    
    // Test database connection - for hybrid system, either SQLite or JSON fallback is valid
    if (!db || (!db.isNativeSQLite && !db.isMemoryFallback)) {
      throw new Error('Database connection failed - neither SQLite nor JSON fallback initialized');
    }
    
    // Sync database debug logger with current settings
    if (db && db.setDebugEnabled) {
      // Try to load current settings and apply debug mode
      try {
        const settingsPath = getSettingsPath();
        if (fs.existsSync(settingsPath)) {
          const settingsData = fs.readFileSync(settingsPath, 'utf8');
          const settings = JSON.parse(settingsData);
          if (settings.debugMode !== undefined) {
            db.setDebugEnabled(settings.debugMode);
          }
        } else {
          // Use default settings
          const defaults = getDefaultSettings();
          db.setDebugEnabled(defaults.debugMode);
        }
      } catch (err) {
        console.error('Failed to sync database debug logger with settings:', err);
      }
    }
    
    // Database initialized - P&L matching is now manual only
    debugLogger.log('Database ready. P&L matching is available through Settings menu.');
    
    // Run one-time migration to fix timezone issues
    debugLogger.log('Running timezone migration...');
    migrateTimezoneIssues();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    debugLogger.log('Database initialization failed:', error.message);
    
    // Set db to null to ensure error handlers work correctly
    db = null;
    
    // Try to show error to user
    if (mainWindow && !mainWindow.isDestroyed()) {
      const errorMessage = `Database initialization failed: ${error.message}\n\nPlease restart the application or contact support.`;
      dialog.showErrorBox('Database Error', errorMessage);
    }
  }
}

// IPC handlers for database operations
ipcMain.handle('save-trade', async (event, trade) => {
  try {
    if (!db) {
      throw new Error('Database not initialized - cannot save trade');
    }
    
    const result = await db.saveTrade(trade);
    let pnlMatchingRan = false;
    
    // Auto-run P&L matching if this trade could potentially match with existing trades
    // Only for BUY/SELL trades (not options or other complex instruments)
    if (trade.side === 'BUY' || trade.side === 'SELL') {
      debugLogger.log(`Auto-checking for potential P&L matches after saving ${trade.side} trade for ${trade.symbol}...`);
      try {
        // Check if there are opposing trades for this symbol
        const allTrades = await db.getTrades({ symbol: trade.symbol });
        const unmatchedTrades = allTrades.filter(t => t.pnl === null || t.pnl === undefined);
        const buys = unmatchedTrades.filter(t => t.side === 'BUY').length;
        const sells = unmatchedTrades.filter(t => t.side === 'SELL').length;
        
        // If we have both buys and sells for this symbol, run P&L matching
        if (buys > 0 && sells > 0) {
          debugLogger.log(`Found ${buys} buys and ${sells} sells for ${trade.symbol} - auto-running P&L matching...`);
          await matchAndCalculatePnL();
          debugLogger.log('Auto P&L matching completed after trade save');
          pnlMatchingRan = true;
        } else {
          debugLogger.log(`No matching opportunities for ${trade.symbol} (${buys} buys, ${sells} sells)`);
        }
      } catch (matchError) {
        console.error('Auto P&L matching failed after trade save:', matchError);
      }
    }
    
    // Always trigger window reload after manual trade save to ensure all components update
    setTimeout(() => {
      debugLogger.log(`Triggering window reload after manual trade save${pnlMatchingRan ? ' (with P&L matching)' : ''}...`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    }, pnlMatchingRan ? 500 : 100);
    
    return result;
  } catch (error) {
    console.error('Failed to save trade:', error);
    throw error;
  }
});

// Bulk trade save handler to prevent excessive re-renders during CSV import
ipcMain.handle('save-trades-bulk', async (event, trades) => {
  try {
    if (!db) {
      throw new Error('Database not initialized - cannot save trades bulk');
    }
    
    const savedTrades = [];
    let shouldRunPnLMatching = false;
    
    debugLogger.log(`Starting bulk save of ${trades.length} trades...`);
    
    // Save all trades first without triggering P&L matching for each
    for (const trade of trades) {
      const result = await db.saveTrade(trade);
      savedTrades.push(result);
      
      // Check if we should run P&L matching at the end
      if (trade.side === 'BUY' || trade.side === 'SELL') {
        shouldRunPnLMatching = true;
      }
    }
    
    debugLogger.log(`Bulk save completed: ${savedTrades.length} trades saved`);
    
    // Run P&L matching once at the end if needed
    if (shouldRunPnLMatching) {
      debugLogger.log('Running P&L matching after bulk import...');
      try {
        await matchAndCalculatePnL();
        debugLogger.log('Bulk P&L matching completed');
      } catch (matchError) {
        console.error('Bulk P&L matching failed:', matchError);
      }
    }
    
    // Reload window after bulk import to refresh all views
    setTimeout(() => {
      debugLogger.log('Reloading window after bulk import to refresh all data...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    }, 500);
    
    return savedTrades;
  } catch (error) {
    console.error('Failed to save trades bulk:', error);
    throw error;
  }
});

ipcMain.handle('get-trades', async (event, filters) => {
  try {
    if (!db) {
      throw new Error('Database not initialized - cannot get trades');
    }
    return await db.getTrades(filters);
  } catch (error) {
    console.error('Failed to get trades:', error);
    throw error;
  }
});

ipcMain.handle('update-trade', async (event, id, updates) => {
  try {
    if (!db) {
      throw new Error('Database not initialized - cannot update trade');
    }
    return await db.updateTrade(id, updates);
  } catch (error) {
    console.error('Failed to update trade:', error);
    throw error;
  }
});

ipcMain.handle('delete-trade', async (event, id) => {
  try {
    if (!db) {
      throw new Error('Database not initialized - cannot delete trade');
    }
    return await db.deleteTrade(id);
  } catch (error) {
    console.error('Failed to delete trade:', error);
    throw error;
  }
});

ipcMain.handle('get-performance-metrics', async (event, dateRange) => {
  try {
    if (!db) {
      throw new Error('Database not initialized - cannot get performance metrics');
    }
    return await db.getPerformanceMetrics(dateRange);
  } catch (error) {
    console.error('Failed to get performance metrics:', error);
    throw error;
  }
});

ipcMain.handle('get-calendar-data', async (event, month, year) => {
  try {
    if (!db) {
      throw new Error('Database not initialized - cannot get calendar data');
    }
    return await db.getCalendarData(month, year);
  } catch (error) {
    console.error('Failed to get calendar data:', error);
    throw error;
  }
});

// Daily notes handlers
ipcMain.handle('save-daily-note', async (event, date, notes) => {
  try {
    return await db.saveDailyNote(date, notes);
  } catch (error) {
    console.error('Failed to save daily note:', error);
    throw error;
  }
});

ipcMain.handle('get-daily-note', async (event, date) => {
  try {
    return await db.getDailyNote(date);
  } catch (error) {
    console.error('Failed to get daily note:', error);
    throw error;
  }
});

ipcMain.handle('delete-daily-note', async (event, date) => {
  try {
    return await db.deleteDailyNote(date);
  } catch (error) {
    console.error('Failed to delete daily note:', error);
    throw error;
  }
});

// Settings handlers
ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const settingsPath = getSettingsPath();
    const settingsDir = path.dirname(settingsPath);
    
    // Ensure directory exists
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    // Update debug logger with new settings
    if (settings.debugMode !== undefined) {
      debugLogger.setEnabled(settings.debugMode);
      // Also sync with database debug logger if available
      if (db && db.setDebugEnabled) {
        db.setDebugEnabled(settings.debugMode);
      }
    }
    debugLogger.log('Settings saved successfully');
    return { success: true };
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
});

ipcMain.handle('load-settings', async (event) => {
  try {
    const settingsPath = getSettingsPath();
    
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      debugLogger.log('Settings loaded successfully');
      // Initialize debug logger with loaded settings
      if (settings.debugMode !== undefined) {
        debugLogger.setEnabled(settings.debugMode);
        // Also sync with database debug logger if available
        if (db && db.setDebugEnabled) {
          db.setDebugEnabled(settings.debugMode);
        }
      }
      return { ...getDefaultSettings(), ...settings };
    } else {
      debugLogger.log('No settings file found, using defaults');
      // Initialize debug logger with default settings
      const defaults = getDefaultSettings();
      debugLogger.setEnabled(defaults.debugMode);
      // Also sync with database debug logger if available
      if (db && db.setDebugEnabled) {
        db.setDebugEnabled(defaults.debugMode);
      }
      return defaults;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    return getDefaultSettings();
  }
});

// Backup and restore handlers
ipcMain.handle('backup-database', async (event) => {
  try {
    // Use Downloads folder with automatic filename
    const downloadsPath = app.getPath('downloads');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupPath = path.join(downloadsPath, `TradingBook_backup_${timestamp}.db`);
    
    const dbPath = db.getDatabasePath();
    
    // Ensure database is properly closed/synced before copying
    db.checkpoint();
    
    fs.copyFileSync(dbPath, backupPath);
    debugLogger.log('Database backup created:', backupPath);
    return { success: true, path: backupPath };
  } catch (error) {
    console.error('Failed to backup database:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restore-database', async (event) => {
  try {
    // Show file picker dialog for backup file
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Database Backup File',
      defaultPath: app.getPath('downloads'),
      filters: [
        { name: 'Database Files', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, error: 'No file selected' };
    }

    const backupPath = result.filePaths[0];
    
    // Verify the backup file exists
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup file not found' };
    }
    
    const dbPath = db.getDatabasePath();
    
    // Close current database
    db.close();
    
    // Replace current database with backup
    fs.copyFileSync(backupPath, dbPath);
    
    // Reinitialize database
    db = new DatabaseManager();
    
    debugLogger.log('Database restored from:', backupPath);
    
    // Send refresh signal to React app instead of reloading window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('database-restored');
    }
    
    return { success: true, path: backupPath };
  } catch (error) {
    console.error('Failed to restore database:', error);
    
    // Try to reinitialize database if something went wrong
    try {
      db = new DatabaseManager();
    } catch (reinitError) {
      console.error('Failed to reinitialize database after restore error:', reinitError);
    }
    
    return { success: false, error: error.message };
  }
});

// Purge database handler
ipcMain.handle('purge-database', async (event) => {
  try {
    debugLogger.log('Starting complete database purge and reinitialization...');
    
    // Get the database path before closing
    const dbPath = db.getDatabasePath();
    debugLogger.log('Database path to purge:', dbPath);
    
    // Force WAL checkpoint to ensure all data is written to main database file (SQLite only)
    try {
      if (db && db.db && db.isNativeSQLite) {
        db.db.exec('PRAGMA wal_checkpoint(FULL);');
        debugLogger.log('WAL checkpoint completed');
      } else if (db && db.isMemoryFallback) {
        debugLogger.log('JSON storage - no WAL checkpoint needed');
      }
    } catch (walError) {
      debugLogger.log('WAL checkpoint failed (database may be closed):', walError.message);
    }
    
    // Close current database connection with proper cleanup
    if (db) {
      try {
        db.close();
        debugLogger.log('Database connection closed');
      } catch (closeError) {
        debugLogger.log('Error closing database (may already be closed):', closeError.message);
      }
    }
    
    // Wait a moment for file handles to be released
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Delete the database file and associated files
    const filesToDelete = [
      dbPath,
      dbPath + '-wal',  // WAL file
      dbPath + '-shm'   // Shared memory file
    ];
    
    for (const filePath of filesToDelete) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          debugLogger.log('Deleted file:', filePath);
        }
      } catch (deleteError) {
        debugLogger.log('Could not delete file (may not exist):', filePath, deleteError.message);
      }
    }
    
    // Wait another moment before reinitializing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Reinitialize database with fresh schema
    try {
      db = new DatabaseManager();
      debugLogger.log('Database reinitialized with fresh schema');
    } catch (initError) {
      debugLogger.log('Error reinitializing database:', initError.message);
      throw initError;
    }
    
    debugLogger.log('Complete database purge successful - all data cleared');
    
    // Reload the window to refresh all React components with empty database
    setTimeout(() => {
      debugLogger.log('Reloading window to refresh React app with empty database...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    }, 500);
    
    return { success: true };
  } catch (error) {
    console.error('Failed to purge database:', error);
    debugLogger.log('Purge database error details:', error.message);
    
    // Try to reinitialize database if something went wrong
    try {
      db = new DatabaseManager();
      debugLogger.log('Database reinitialized after purge error');
      
      // Send error notification to React app instead of reloading
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('database-error', 'Purge failed but database reinitialized');
        }
      }, 500);
    } catch (reinitError) {
      console.error('Failed to reinitialize database after purge error:', reinitError);
    }
    
    return { success: false, error: error.message };
  }
});

// CSV Import/Export handlers
ipcMain.handle('export-csv', async (event) => {
  try {
    // Use Downloads folder with automatic filename
    const downloadsPath = app.getPath('downloads');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const exportPath = path.join(downloadsPath, `TradingBook_trades_${timestamp}.csv`);
    
    // Get all trades from database
    const trades = await db.getTrades({});
    
    // Convert to CSV format
    const csvHeader = 'ID,Symbol,Side,Quantity,Entry Price,Exit Price,Entry Date,Exit Date,P&L,Commission,Strategy,Notes,Tags,Asset Type,Option Type,Strike Price,Expiration Date\n';
    const csvRows = trades.map(trade => {
      const row = [
        trade.id,
        trade.symbol,
        trade.side,
        trade.quantity,
        trade.entryPrice,
        trade.exitPrice || '',
        trade.entryDate,
        trade.exitDate || '',
        trade.pnl || '',
        trade.commission || '',
        trade.strategy || '',
        trade.notes ? `"${trade.notes.replace(/"/g, '""')}"` : '', // Escape quotes in notes
        trade.tags || '',
        trade.assetType,
        trade.optionType || '',
        trade.strikePrice || '',
        trade.expirationDate || ''
      ];
      return row.join(',');
    }).join('\n');
    
    const csvContent = csvHeader + csvRows;
    fs.writeFileSync(exportPath, csvContent, 'utf8');
    
    debugLogger.log('CSV export completed:', exportPath);
    return { success: true, path: exportPath, count: trades.length };
  } catch (error) {
    console.error('Failed to export CSV:', error);
    return { success: false, error: error.message };
  }
});

// Function to match buy/sell pairs and calculate P&L
async function matchAndCalculatePnL() {
  try {
    debugLogger.log('Starting P&L matching process...');
    
    let hasMatches = true;
    let iterationCount = 0;
    const maxIterations = 650; // Safety limit to prevent infinite loops
    
    while (hasMatches && iterationCount < maxIterations) {
      iterationCount++;
      hasMatches = false;
      
      debugLogger.log(`--- P&L Matching Iteration ${iterationCount} ---`);
      
      // Get fresh trades from database for each iteration
      const allTrades = await db.getTrades();
      debugLogger.log(`Found ${allTrades.length} total trades in database`);

      // Filter out trades that already have P&L calculated (already matched)
      const unmatchedTrades = allTrades.filter(trade => trade.pnl === null || trade.pnl === undefined);
      debugLogger.log(`Found ${unmatchedTrades.length} unmatched trades to process`);

      if (unmatchedTrades.length === 0) {
        debugLogger.log('No unmatched trades found - all trades already have P&L calculated');
        break;
      }

      // Group trades by symbol
      const tradesBySymbol = {};
      unmatchedTrades.forEach(trade => {
        const symbol = trade.symbol;
        if (!tradesBySymbol[symbol]) {
          tradesBySymbol[symbol] = { buys: [], sells: [] };
        }
        
        if (trade.side === 'BUY') {
          tradesBySymbol[symbol].buys.push(trade);
        } else if (trade.side === 'SELL') {
          tradesBySymbol[symbol].sells.push(trade);
        }
      });

      debugLogger.log(`Processing ${Object.keys(tradesBySymbol).length} symbols for matching`);

      // Process each symbol to find and create one match per iteration
      for (const symbol in tradesBySymbol) {
        const { buys, sells } = tradesBySymbol[symbol];
        debugLogger.log(`Processing ${symbol}: ${buys.length} buys, ${sells.length} sells`);
        
        if (buys.length === 0 || sells.length === 0) {
          debugLogger.log(`Skipping ${symbol} - no matching pairs possible`);
          continue;
        }
        
        // Sort by date for FIFO matching
        buys.sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));
        sells.sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));

        // Find first available buy and sell to match
        const buy = buys[0];
        const sell = sells[0];
        
        // Match quantities using FIFO
        const matchedQuantity = Math.min(buy.quantity, sell.quantity);
        
        if (matchedQuantity > 0) {
          // Calculate P&L
          const entryPrice = buy.entryPrice;
          const exitPrice = sell.entryPrice; // Sell price becomes exit price
          const pnl = (exitPrice - entryPrice) * matchedQuantity - (buy.commission || 0) - (sell.commission || 0);

          debugLogger.log(`Matching ${symbol}: ${matchedQuantity} shares @ ${entryPrice} -> ${exitPrice}, P&L: ${pnl.toFixed(2)}`);

          // Create a new complete trade with P&L
          const completeTrade = {
            symbol: buy.symbol,
            side: 'BUY', // Keep as BUY to maintain the trade direction
            quantity: matchedQuantity,
            entryPrice: entryPrice,
            exitPrice: exitPrice,
            entryDate: buy.entryDate,
            exitDate: sell.entryDate,
            pnl: pnl,
            commission: (buy.commission || 0) + (sell.commission || 0),
            strategy: buy.strategy || 'Imported',
            notes: `Matched trade: Buy ${buy.id} + Sell ${sell.id}`,
            tags: buy.tags || '',
            screenshots: buy.screenshots || '',
            assetType: buy.assetType || 'STOCK',
            optionType: buy.optionType,
            strikePrice: buy.strikePrice,
            expirationDate: buy.expirationDate
          };

          // Save the complete trade
          await db.saveTrade(completeTrade);
          debugLogger.log(`Created complete trade for ${matchedQuantity} shares of ${symbol} with P&L: $${pnl.toFixed(2)}`);

          // Delete the original buy and sell trades
          await db.deleteTrade(buy.id);
          await db.deleteTrade(sell.id);
          debugLogger.log(`Deleted original buy trade ${buy.id} and sell trade ${sell.id}`);

          // Handle partial fills
          if (buy.quantity > matchedQuantity) {
            // Create a new buy trade for the remainder
            const remainderQty = buy.quantity - matchedQuantity;
            const remainderTrade = {
              symbol: buy.symbol,
              side: 'BUY',
              quantity: remainderQty,
              entryPrice: buy.entryPrice,
              exitPrice: null,
              entryDate: buy.entryDate,
              exitDate: null,
              pnl: null,
              commission: 0, // Commission already accounted for in the matched trade
              strategy: buy.strategy,
              notes: (buy.notes || '') + ' (Remainder after partial match)',
              tags: buy.tags || '',
              screenshots: buy.screenshots || '',
              assetType: buy.assetType || 'STOCK',
              optionType: buy.optionType,
              strikePrice: buy.strikePrice,
              expirationDate: buy.expirationDate
            };
            
            await db.saveTrade(remainderTrade);
            debugLogger.log(`Created remainder buy trade for ${remainderQty} shares of ${symbol}`);
          }

          if (sell.quantity > matchedQuantity) {
            // Create a new sell trade for the remainder
            const remainderQty = sell.quantity - matchedQuantity;
            const remainderTrade = {
              symbol: sell.symbol,
              side: 'SELL',
              quantity: remainderQty,
              entryPrice: sell.entryPrice,
              exitPrice: null,
              entryDate: sell.entryDate,
              exitDate: null,
              pnl: null,
              commission: 0,
              strategy: sell.strategy,
              notes: (sell.notes || '') + ' (Remainder after partial match)',
              tags: sell.tags || '',
              screenshots: sell.screenshots || '',
              assetType: sell.assetType || 'STOCK',
              optionType: sell.optionType,
              strikePrice: sell.strikePrice,
              expirationDate: sell.expirationDate
            };
            
            await db.saveTrade(remainderTrade);
            debugLogger.log(`Created remainder sell trade for ${remainderQty} shares of ${symbol}`);
          }

          hasMatches = true;
          break; // Process one match per iteration to avoid stale data issues
        }
      }
    }

    if (iterationCount >= maxIterations) {
      console.warn('P&L matching stopped due to iteration limit - possible infinite loop detected');
    }

    debugLogger.log('P&L matching completed successfully');
  } catch (error) {
    console.error('Error in matchAndCalculatePnL:', error);
  }
}

ipcMain.handle('import-csv', async (event) => {
  try {
    // Show file picker dialog for CSV file
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select CSV File to Import',
      defaultPath: app.getPath('downloads'),
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, error: 'No file selected' };
    }

    const csvPath = result.filePaths[0];
    
    // Verify the CSV file exists
    if (!fs.existsSync(csvPath)) {
      return { success: false, error: 'CSV file not found' };
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV (simple implementation)
    const lines = csvContent.split('\n');
    const header = lines[0];
    const dataLines = lines.slice(1).filter(line => line.trim().length > 0);
    
    let importedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < dataLines.length; i++) {
      try {
        const line = dataLines[i].trim();
        
        // Enhanced CSV parsing for properly quoted fields with embedded commas
        let values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          const nextChar = j + 1 < line.length ? line[j + 1] : '';
          
          if (char === '"' && nextChar === '"') {
            // Handle escaped quotes ("")
            current += '"';
            j++; // Skip next character
          } else if (char === '"') {
            // Toggle quote state
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            // Field separator outside quotes
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim()); // Add the last field
        
        debugLogger.log(`Debug line ${i + 2}: parsed ${values.length} fields:`, values.map(v => `"${v}"`));
        
        // Check if this looks like a Schwab CSV format
        if (values.length >= 8 && values[0] && values[1] && values[2] && values[4] && values[5]) {
          // Schwab format: Date, Action, Symbol, Description, Quantity, Price, Fees & Comm, Amount
          const action = values[1].trim();
          const symbol = values[2].trim();
          
          // Skip non-trading actions
          if (!action || !['Buy', 'Sell'].includes(action)) {
            debugLogger.log(`Skipping non-trading action: ${action}`);
            continue;
          }
          
          if (!symbol) {
            debugLogger.log(`Skipping empty symbol`);
            continue;
          }
          
          const quantity = Math.abs(parseFloat(values[4].replace(/[,$"]/g, '')) || 0);
          const price = parseFloat(values[5].replace(/[$,"]/g, '') || '0');
          const commission = Math.abs(parseFloat(values[6].replace(/[$,"]/g, '') || '0'));
          
          // Parse Schwab date format MM/DD/YYYY
          let entryDate = new Date().toISOString();
          if (values[0] && values[0].includes('/')) {
            const dateParts = values[0].split('/');
            if (dateParts.length === 3) {
              const [month, day, year] = dateParts.map(p => parseInt(p, 10));
              if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
                entryDate = new Date(year, month - 1, day).toISOString();
              }
            }
          }
          
          const trade = {
            symbol: symbol.toUpperCase(),
            side: action.toUpperCase(),
            quantity: quantity,
            entryPrice: price,
            exitPrice: null,
            entryDate: entryDate,
            exitDate: null,
            pnl: null,
            commission: commission,
            strategy: '',
            notes: `Imported from Schwab CSV - ${values[3] || ''}`.trim(),
            tags: '',
            assetType: 'STOCK',
            optionType: null,
            strikePrice: null,
            expirationDate: null
          };
          
          // Validate required fields
          if (!trade.symbol || trade.quantity <= 0 || trade.entryPrice <= 0) {
            errors.push(`Line ${i + 2}: Invalid required fields - Symbol: ${trade.symbol}, Quantity: ${trade.quantity}, Price: ${trade.entryPrice}`);
            errorCount++;
            continue;
          }
          
          // Save trade
          await db.saveTrade(trade);
          importedCount++;
          debugLogger.log(`Successfully imported: ${trade.symbol} ${trade.side} ${trade.quantity} @ ${trade.entryPrice}`);
          
        } else {
          // Original format for backward compatibility  
          const trade = {
            symbol: values[1]?.trim() || '',
            side: values[2]?.trim() || 'BUY',
            quantity: parseFloat(values[3]) || 0,
            entryPrice: parseFloat(values[4]) || 0,
            exitPrice: values[5] ? parseFloat(values[5]) : null,
            entryDate: values[6]?.trim() || new Date().toISOString(),
            exitDate: values[7]?.trim() || null,
            pnl: values[8] ? parseFloat(values[8]) : null,
            commission: values[9] ? parseFloat(values[9]) : 0,
            strategy: values[10]?.trim() || '',
            notes: values[11]?.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"') || '',
            tags: values[12]?.trim() || '',
            assetType: values[13]?.trim() || 'STOCK',
            optionType: values[14]?.trim() || null,
            strikePrice: values[15] ? parseFloat(values[15]) : null,
            expirationDate: values[16]?.trim() || null
          };
          
          // Validate required fields
          if (!trade.symbol || trade.quantity <= 0 || trade.entryPrice <= 0) {
            errors.push(`Line ${i + 2}: Invalid required fields`);
            errorCount++;
            continue;
          }
          
          // Save trade
          await db.saveTrade(trade);
          importedCount++;
        }
        
      } catch (lineError) {
        errors.push(`Line ${i + 2}: ${lineError.message}`);
        errorCount++;
      }
    }
    
    debugLogger.log(`CSV import completed: ${importedCount} imported, ${errorCount} errors`);
    
    // Automatically run P&L matching if we imported trades
    if (importedCount > 0) {
      debugLogger.log('Auto-running P&L matching after CSV import...');
      try {
        await matchAndCalculatePnL();
        debugLogger.log('Auto P&L matching completed after CSV import');
        
        // Reload window to refresh all views with new data
        setTimeout(() => {
          debugLogger.log('Reloading window after CSV import P&L matching to refresh all data...');
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.reload();
          }
        }, 500);
      } catch (matchError) {
        console.error('Auto P&L matching failed after CSV import:', matchError);
      }
    }
    
    return { 
      success: true, 
      path: csvPath, 
      imported: importedCount, 
      errors: errorCount,
      errorDetails: errors.slice(0, 10), // Return first 10 errors
      autoMatched: importedCount > 0 // Indicate if P&L matching was run
    };
  } catch (error) {
    console.error('Failed to import CSV:', error);
    return { success: false, error: error.message };
  }
});

// Add IPC handler for manual P&L matching
ipcMain.handle('match-pnl', async (event) => {
  try {
    debugLogger.log('Manual P&L matching triggered...');
    await matchAndCalculatePnL();
    debugLogger.log('P&L matching completed successfully');
    
    // Reload window to refresh all views with updated P&L data
    setTimeout(() => {
      debugLogger.log('Reloading window after P&L matching to refresh all data...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    }, 500);
    
    return { success: true, message: 'P&L matching completed successfully' };
  } catch (error) {
    console.error('Failed to match P&L:', error);
    return { success: false, error: error.message };
  }
});

// Add IPC handler for Yahoo Finance API to avoid CORS issues
ipcMain.handle('fetch-stock-data', async (event, symbol) => {
  try {
    debugLogger.log(`Fetching stock data for ${symbol}...`);
    
    const https = require('https');
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
    
    const response = await new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (parseError) {
            reject(new Error('Failed to parse Yahoo Finance response'));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
    
    if (response.chart?.error || !response.chart?.result?.[0]) {
      throw new Error('Invalid symbol or no data available from Yahoo Finance');
    }
    
    const result = response.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators?.quote?.[0];
    
    if (!timestamps || !quotes) {
      throw new Error('No price data available from Yahoo Finance');
    }
    
    // Convert Yahoo Finance data to our format
    const chartData = timestamps.map((timestamp, index) => {
      const date = new Date(timestamp * 1000);
      return {
        date: date.toISOString().split('T')[0],
        open: quotes.open?.[index] || 0,
        high: quotes.high?.[index] || 0,
        low: quotes.low?.[index] || 0,
        close: quotes.close?.[index] || 0,
        volume: quotes.volume?.[index] || 0
      };
    }).filter(point => point.close > 0); // Filter out invalid data points
    
    if (chartData.length === 0) {
      throw new Error('No valid price data found');
    }
    
    debugLogger.log(`Successfully fetched ${chartData.length} data points for ${symbol}`);
    return { success: true, data: chartData };
    
  } catch (error) {
    console.error(`Failed to fetch stock data for ${symbol}:`, error.message);
    return { success: false, error: error.message };
  }
});

// Add IPC handler for checking updates
ipcMain.handle('check-for-updates', async (event) => {
  try {
    debugLogger.log('Checking for updates...');
    
    const https = require('https');
    const packageJson = require('../package.json');
    const currentVersion = packageJson.version;
    const repoUrl = 'https://api.github.com/repos/appatalks/TradingBook/releases/latest';
    
    const response = await new Promise((resolve, reject) => {
      const req = https.get(repoUrl, {
        headers: {
          'User-Agent': 'TradingBook-App'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (parseError) {
            reject(new Error('Failed to parse GitHub API response'));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
    
    const latestVersion = response.tag_name?.replace('v', '') || response.name?.replace('v', '');
    const releaseNotes = response.body?.substring(0, 200) + (response.body?.length > 200 ? '...' : '') || 'No release notes available';
    const downloadUrl = `https://github.com/appatalks/TradingBook/releases/latest`;
    
    debugLogger.log(`Current version: ${currentVersion}, Latest version: ${latestVersion}`);
    
    // Simple version comparison (works for semantic versioning)
    const hasUpdate = latestVersion && latestVersion !== currentVersion;
    
    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseNotes,
      downloadUrl
    };
    
  } catch (error) {
    console.error('Failed to check for updates:', error.message);
    return {
      hasUpdate: false,
      currentVersion: require('../package.json').version,
      error: error.message
    };
  }
});

// Add IPC handler for opening external links
ipcMain.handle('open-external', async (event, url) => {
  try {
    debugLogger.log(`Opening external URL: ${url}`);
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: error.message };
  }
});

// Add IPC handler for getting Downloads path
ipcMain.handle('get-downloads-path', async (event) => {
  try {
    const downloadsPath = app.getPath('downloads');
    return { success: true, path: downloadsPath };
  } catch (error) {
    console.error('Failed to get downloads path:', error);
    return { success: false, error: error.message };
  }
});

// Add IPC handler for debugging database status
ipcMain.handle('get-database-status', async (event) => {
  try {
    const userDataPath = app.getPath('userData');
    const status = {
      initialized: !!db,
      connected: !!(db && (db.isNativeSQLite || db.isMemoryFallback)),
      dbPath: db ? db.getDatabasePath() : path.join(userDataPath, 'trades.db'),
      userDataPath: userDataPath,
      platform: process.platform,
      isDev: require('electron-is-dev'),
      platformDisplay: process.platform === 'win32' ? 'Windows' : 
                      process.platform === 'darwin' ? 'macOS' : 
                      process.platform === 'linux' ? 'Linux' : process.platform
    };
    
    // Test a simple query if database is available
    if (db && db.isNativeSQLite && db.db) {
      try {
        db.db.prepare('SELECT 1 as test').get();
        status.queryTest = 'SUCCESS (SQLite)';
      } catch (queryError) {
        status.queryTest = `FAILED: ${queryError.message}`;
      }
    } else if (db && db.isMemoryFallback) {
      status.queryTest = 'SUCCESS (JSON fallback)';
    }
    
    debugLogger.log('Database status check:', status);
    
    return { success: true, status };
  } catch (error) {
    console.error('Failed to get database status:', error);
    return { success: false, error: error.message };
  }
});

// Add IPC handler for debug logger control
ipcMain.handle('set-debug-enabled', async (event, enabled) => {
  try {
    debugLogger.setEnabled(enabled);
    // Also sync with database debug logger if available
    if (db && db.setDebugEnabled) {
      db.setDebugEnabled(enabled);
    }
    debugLogger.log(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to set debug mode:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  debugLogger.log('App ready, starting initialization...');
  initDatabase();
  
  // Wait a bit to ensure database is initialized
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test database connection before creating window
  if (db && (db.isNativeSQLite || db.isMemoryFallback)) {
    debugLogger.log('Database initialization confirmed before window creation');
  } else {
    debugLogger.log('WARNING: Database not initialized properly before window creation');
  }
  
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) {
      db.close();
    }
    if (localServer) {
      localServer.close();
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (db) {
    db.close();
  }
});

// One-time migration to fix timezone issues for trades that should appear on local dates
async function migrateTimezoneIssues() {
  try {
    debugLogger.log('Starting timezone migration check...');
    
    // Check if WF trade with ID 341 needs timezone correction
    const wfTrades = await db.getTrades({ symbol: 'WF' });
    debugLogger.log(`Found ${wfTrades.length} WF trades`);
    
    const problematicTrade = wfTrades.find(t => {
      debugLogger.log(`Checking trade ID ${t.id}: entryDate=${t.entryDate}, pnl=${t.pnl}`);
      return t.id === 341 && 
             t.entryDate === '2025-08-26T03:34:00.000Z' &&
             Math.abs(t.pnl - 19.85) < 0.01;
    });
    
    if (problematicTrade) {
      debugLogger.log('Found problematic WF trade, migrating timezone...');
      await db.updateTrade(341, {
        entryDate: '2025-08-25T22:34:00.000Z', // Local time equivalent
        exitDate: '2025-08-25T22:39:00.000Z'   // Local time equivalent if it exists
      });
      debugLogger.log('WF trade timezone migration completed');
    } else {
      debugLogger.log('No problematic WF trade found - migration not needed');
    }
  } catch (error) {
    debugLogger.log('Timezone migration failed:', error.message);
  }
}
