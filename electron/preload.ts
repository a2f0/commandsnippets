import {electronAPI} from '@electron-toolkit/preload';
import {contextBridge, ipcRenderer} from 'electron';

// Store listener functions for proper cleanup
const protocolUrlListeners = new Set<(url: string) => void>();

// Custom APIs for renderer
const api = {
  onProtocolUrl: (callback: (url: string) => void) => {
    const wrappedCallback = (_: unknown, url: string) => callback(url);
    protocolUrlListeners.add(callback);
    ipcRenderer.on('protocol-url', wrappedCallback);

    // Return cleanup function
    return () => {
      protocolUrlListeners.delete(callback);
      ipcRenderer.removeListener('protocol-url', wrappedCallback);
    };
  },
  removeProtocolUrlListener: (callback: (url: string) => void) => {
    protocolUrlListeners.delete(callback);
    // Note: This removes all listeners for this event since we can't match the wrapper
    // In practice, this should only be called when shutting down
    ipcRenderer.removeAllListeners('protocol-url');
  },
};

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
}
