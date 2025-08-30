const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');
const os = require('os');
const DatabaseManager = require('../src/database/Database');

let mainWindow;
let db;

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
    darkMode: false
  };
}

function createWindow() {
  // Get screen dimensions for better initial sizing
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // Calculate optimal window size (85% of screen size, with larger minimums for trading interface)
  const windowWidth = Math.max(1600, Math.min(screenWidth * 0.85, 1920));
  const windowHeight = Math.max(1000, Math.min(screenHeight * 0.85, 1200));
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 1400,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
    center: true, // Center the window on screen
    title: 'TradingBook - Trading Journal'
  });

  // In production (packaged app), electron.js runs from public/ and needs to find build/index.html
  const startUrl = isDev
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '..', 'build', 'index.html')}`;
  
  console.log('isDev:', isDev);
  console.log('__dirname:', __dirname);
  console.log('Loading URL:', startUrl);

  // Listen to console messages from renderer process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER ${level}]:`, message);
    if (sourceId) console.log(`  Source: ${sourceId}:${line}`);
  });

  // Listen for errors
  mainWindow.webContents.on('crashed', (event, killed) => {
    console.log('Renderer process crashed:', killed);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.log('Renderer process became unresponsive');
  });

  mainWindow.loadURL(startUrl);

  // Open DevTools in development or for debugging
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Simple check after a delay
    setTimeout(() => {
      console.log('Checking React mount status...');
      mainWindow.webContents.executeJavaScript('document.getElementById("root").innerHTML.length').then(length => {
        console.log('React root content length:', length);
        if (length > 0) {
          console.log('SUCCESS: React app mounted successfully!');
        } else {
          console.log('ERROR: React app failed to mount - opening DevTools for debugging');
          mainWindow.webContents.openDevTools();
        }
      }).catch(err => {
        console.log('Error checking React mount:', err.message);
      });
    }, 5000);
  });

  // Prevent navigation to external URLs only
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Only prevent navigation to external protocols (http, https, etc.)
    // React Router with MemoryRouter shouldn't trigger this event
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      event.preventDefault();
      console.log('Prevented external navigation to:', navigationUrl);
    }
  });

  // Handle new window requests (prevent opening external links)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Trades',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            }).then(result => {
              if (!result.canceled) {
                mainWindow.webContents.send('import-trades', result.filePaths[0]);
              }
            });
          }
        },
        {
          label: 'Export Data',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.send('export-data');
          }
        },
        { type: 'separator' },
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
    db = new DatabaseManager();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

// IPC handlers for database operations
ipcMain.handle('save-trade', async (event, trade) => {
  try {
    return await db.saveTrade(trade);
  } catch (error) {
    console.error('Failed to save trade:', error);
    throw error;
  }
});

ipcMain.handle('get-trades', async (event, filters) => {
  try {
    return await db.getTrades(filters);
  } catch (error) {
    console.error('Failed to get trades:', error);
    throw error;
  }
});

ipcMain.handle('update-trade', async (event, id, updates) => {
  try {
    return await db.updateTrade(id, updates);
  } catch (error) {
    console.error('Failed to update trade:', error);
    throw error;
  }
});

ipcMain.handle('delete-trade', async (event, id) => {
  try {
    return await db.deleteTrade(id);
  } catch (error) {
    console.error('Failed to delete trade:', error);
    throw error;
  }
});

ipcMain.handle('get-performance-metrics', async (event, dateRange) => {
  try {
    return await db.getPerformanceMetrics(dateRange);
  } catch (error) {
    console.error('Failed to get performance metrics:', error);
    throw error;
  }
});

ipcMain.handle('get-calendar-data', async (event, month, year) => {
  try {
    return await db.getCalendarData(month, year);
  } catch (error) {
    console.error('Failed to get calendar data:', error);
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
    console.log('Settings saved successfully');
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
      console.log('Settings loaded successfully');
      return { ...getDefaultSettings(), ...settings };
    } else {
      console.log('No settings file found, using defaults');
      return getDefaultSettings();
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    return getDefaultSettings();
  }
});

// Backup and restore handlers
ipcMain.handle('backup-database', async (event) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Database Backup',
      defaultPath: `TradingBook_backup_${new Date().toISOString().split('T')[0]}.db`,
      filters: [
        { name: 'Database Files', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      const dbPath = db.getDatabasePath();
      
      // Ensure database is properly closed/synced before copying
      db.checkpoint();
      
      fs.copyFileSync(dbPath, result.filePath);
      console.log('Database backup created:', result.filePath);
      return { success: true, path: result.filePath };
    }
    
    return { success: false, error: 'Backup canceled' };
  } catch (error) {
    console.error('Failed to backup database:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restore-database', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Database Backup to Restore',
      filters: [
        { name: 'Database Files', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const backupPath = result.filePaths[0];
      const dbPath = db.getDatabasePath();
      
      // Close current database
      db.close();
      
      // Replace current database with backup
      fs.copyFileSync(backupPath, dbPath);
      
      // Reinitialize database
      db = new DatabaseManager();
      
      console.log('Database restored from:', backupPath);
      return { success: true, path: backupPath };
    }
    
    return { success: false, error: 'Restore canceled' };
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
    // Clear all trades from the database
    db.purgeAllTrades();
    
    console.log('Database purged successfully');
    return { success: true };
  } catch (error) {
    console.error('Failed to purge database:', error);
    return { success: false, error: error.message };
  }
});

// CSV Import/Export handlers
ipcMain.handle('export-csv', async (event) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Trades to CSV',
      defaultPath: `TradingBook_trades_${new Date().toISOString().split('T')[0]}.csv`,
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
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
      fs.writeFileSync(result.filePath, csvContent, 'utf8');
      
      console.log('CSV export completed:', result.filePath);
      return { success: true, path: result.filePath, count: trades.length };
    }
    
    return { success: false, error: 'Export canceled' };
  } catch (error) {
    console.error('Failed to export CSV:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-csv', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Trades from CSV',
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const csvPath = result.filePaths[0];
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
          const values = dataLines[i].split(',');
          
          // Skip if not enough columns
          if (values.length < 4) continue;
          
          // Parse trade data (skipping ID column)
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
            notes: values[11]?.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"') || '', // Unescape quotes
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
          
        } catch (lineError) {
          errors.push(`Line ${i + 2}: ${lineError.message}`);
          errorCount++;
        }
      }
      
      console.log(`CSV import completed: ${importedCount} imported, ${errorCount} errors`);
      return { 
        success: true, 
        path: csvPath, 
        imported: importedCount, 
        errors: errorCount,
        errorDetails: errors.slice(0, 10) // Return first 10 errors
      };
    }
    
    return { success: false, error: 'Import canceled' };
  } catch (error) {
    console.error('Failed to import CSV:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  initDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) {
      db.close();
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
