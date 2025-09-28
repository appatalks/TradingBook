const fs = require('fs');
const path = require('path');
const https = require('https');
const tar = require('tar');

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir } = context;
  
  // Only handle Windows builds
  if (electronPlatformName !== 'win32') {
    console.log(`Skipping afterPack for ${electronPlatformName}`);
    return;
  }
  
  console.log('🪟 Windows build detected - fixing better-sqlite3 native module...');
  
  // Try different possible locations for better-sqlite3
  const possiblePaths = [
    path.join(appOutDir, 'resources', 'app', 'node_modules', 'better-sqlite3'),
    path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3'),
    path.join(appOutDir, 'node_modules', 'better-sqlite3')
  ];
  
  let sqliteModulePath = null;
  for (const checkPath of possiblePaths) {
    console.log(`🔍 Checking for better-sqlite3 at: ${checkPath}`);
    if (fs.existsSync(checkPath)) {
      sqliteModulePath = checkPath;
      console.log(`✅ Found better-sqlite3 at: ${checkPath}`);
      break;
    }
  }
  
  if (!sqliteModulePath) {
    console.log('❌ better-sqlite3 module not found in any expected location, skipping fix');
    return;
  }
  
  // Download Windows x64 binary for better-sqlite3
  const version = require('../node_modules/better-sqlite3/package.json').version;
  const binaryUrl = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${version}/better-sqlite3-v${version}-electron-v139-win32-x64.tar.gz`;
  
  console.log(`📥 Downloading Windows binary from: ${binaryUrl}`);
  
  try {
    const tarPath = path.join(appOutDir, 'better-sqlite3-win32.tar.gz');
    
    // Download the tar.gz file
    await downloadFile(binaryUrl, tarPath);
    
    // Extract the native module
    await tar.extract({
      file: tarPath,
      cwd: sqliteModulePath,
      strip: 1
    });
    
    // Clean up
    fs.unlinkSync(tarPath);
    
    console.log('✅ Windows better-sqlite3 binary installed successfully');
  } catch (error) {
    console.error('❌ Failed to install Windows better-sqlite3 binary:', error.message);
    console.log('⚠️  Windows build may not work correctly');
  }
};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
    });
    
    file.on('finish', () => {
      file.close();
      resolve();
    });
    
    request.on('error', reject);
    file.on('error', reject);
  });
}