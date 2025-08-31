const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');
const os = require('os');
const http = require('http');
const url = require('url');
const DatabaseManager = require('../src/database/Database');

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
      console.log(`Local HTTP server started on http://localhost:${port}`);
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
    darkMode: false
  };
}

async function createWindow() {
  // Get screen dimensions for better initial sizing
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // Calculate optimal window size (75% of screen size, with reasonable minimums)
  const windowWidth = Math.max(1300, Math.min(screenWidth * 0.75, 1500));
  const windowHeight = Math.max(900, Math.min(screenHeight * 0.75, 1000));
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 1200,
    minHeight: 750,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Allow loading local resources
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
    center: true, // Center the window on screen
    title: 'TradingBook - Trading Journal'
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
    
    // Database initialized - P&L matching is now manual only
    console.log('Database ready. P&L matching is available through Settings menu.');
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

// Function to match buy/sell pairs and calculate P&L
async function matchAndCalculatePnL() {
  try {
    console.log('Starting P&L matching process...');
    
    let hasMatches = true;
    let iterationCount = 0;
    const maxIterations = 50; // Safety limit to prevent infinite loops
    
    while (hasMatches && iterationCount < maxIterations) {
      iterationCount++;
      hasMatches = false;
      
      console.log(`--- P&L Matching Iteration ${iterationCount} ---`);
      
      // Get fresh trades from database for each iteration
      const allTrades = await db.getTrades();
      console.log(`Found ${allTrades.length} total trades in database`);

      // Filter out trades that already have P&L calculated (already matched)
      const unmatchedTrades = allTrades.filter(trade => trade.pnl === null || trade.pnl === undefined);
      console.log(`Found ${unmatchedTrades.length} unmatched trades to process`);

      if (unmatchedTrades.length === 0) {
        console.log('No unmatched trades found - all trades already have P&L calculated');
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

      console.log(`Processing ${Object.keys(tradesBySymbol).length} symbols for matching`);

      // Process each symbol to find and create one match per iteration
      for (const symbol in tradesBySymbol) {
        const { buys, sells } = tradesBySymbol[symbol];
        console.log(`Processing ${symbol}: ${buys.length} buys, ${sells.length} sells`);
        
        if (buys.length === 0 || sells.length === 0) {
          console.log(`Skipping ${symbol} - no matching pairs possible`);
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

          console.log(`Matching ${symbol}: ${matchedQuantity} shares @ ${entryPrice} -> ${exitPrice}, P&L: ${pnl.toFixed(2)}`);

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
          console.log(`Created complete trade for ${matchedQuantity} shares of ${symbol} with P&L: $${pnl.toFixed(2)}`);

          // Delete the original buy and sell trades
          await db.deleteTrade(buy.id);
          await db.deleteTrade(sell.id);
          console.log(`Deleted original buy trade ${buy.id} and sell trade ${sell.id}`);

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
            console.log(`Created remainder buy trade for ${remainderQty} shares of ${symbol}`);
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
            console.log(`Created remainder sell trade for ${remainderQty} shares of ${symbol}`);
          }

          hasMatches = true;
          break; // Process one match per iteration to avoid stale data issues
        }
      }
    }

    if (iterationCount >= maxIterations) {
      console.warn('P&L matching stopped due to iteration limit - possible infinite loop detected');
    }

    console.log('P&L matching completed successfully');
  } catch (error) {
    console.error('Error in matchAndCalculatePnL:', error);
  }
}

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
          
          console.log(`Debug line ${i + 2}: parsed ${values.length} fields:`, values.map(v => `"${v}"`));
          
          // Check if this looks like a Schwab CSV format
          if (values.length >= 8 && values[0] && values[1] && values[2] && values[4] && values[5]) {
            // Schwab format: Date, Action, Symbol, Description, Quantity, Price, Fees & Comm, Amount
            const action = values[1].trim();
            const symbol = values[2].trim();
            
            // Skip non-trading actions
            if (!action || !['Buy', 'Sell'].includes(action)) {
              console.log(`Skipping non-trading action: ${action}`);
              continue;
            }
            
            if (!symbol) {
              console.log(`Skipping empty symbol`);
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
            console.log(`Successfully imported: ${trade.symbol} ${trade.side} ${trade.quantity} @ ${trade.entryPrice}`);
            
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
      
      console.log(`CSV import completed: ${importedCount} imported, ${errorCount} errors`);
      
      // CSV import complete - P&L matching is now manual only
      console.log('CSV import completed. Use "Match P&L" from Settings menu to calculate P&L for imported trades.');
      
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

// Add IPC handler for manual P&L matching
ipcMain.handle('match-pnl', async (event) => {
  try {
    console.log('Manual P&L matching triggered...');
    await matchAndCalculatePnL();
    return { success: true, message: 'P&L matching completed successfully' };
  } catch (error) {
    console.error('Failed to match P&L:', error);
    return { success: false, error: error.message };
  }
});

// Add IPC handler for Yahoo Finance API to avoid CORS issues
ipcMain.handle('fetch-stock-data', async (event, symbol) => {
  try {
    console.log(`Fetching stock data for ${symbol}...`);
    
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
    
    console.log(`Successfully fetched ${chartData.length} data points for ${symbol}`);
    return { success: true, data: chartData };
    
  } catch (error) {
    console.error(`Failed to fetch stock data for ${symbol}:`, error.message);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  initDatabase();
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
