const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const DatabaseManager = require('../src/database/Database');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  const startUrl = isDev
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  console.log('isDev:', isDev);
  console.log('Loading URL:', startUrl);
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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
