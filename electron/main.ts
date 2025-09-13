import {join} from 'node:path';
import {electronApp, is, optimizer} from '@electron-toolkit/utils';
import {app, BrowserWindow, shell} from 'electron';

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(details => {
    shell.openExternal(details.url);
    return {action: 'deny'};
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// Register custom protocol handler for OAuth redirects
if (process.defaultApp) {
  if (process.argv.length >= 2 && process.argv[1]) {
    app.setAsDefaultProtocolClient('tearleads', process.execPath, [
      process.argv[1],
    ]);
  }
} else {
  app.setAsDefaultProtocolClient('tearleads');
}

// Handle custom protocol URLs (OAuth redirects)
app.on('open-url', (event, url) => {
  console.log('Protocol URL received:', url);
  event.preventDefault();

  // Forward the URL to the renderer process
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    mainWindow.webContents.send('protocol-url', url);
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.tearleads.app');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
