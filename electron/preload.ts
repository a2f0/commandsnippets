import {electronAPI} from '@electron-toolkit/preload';
import {contextBridge, ipcRenderer} from 'electron';

// Custom APIs for renderer
const api = {
  onProtocolUrl: (callback: (url: string) => void) => {
    const wrappedCallback = (_: unknown, url: string) => callback(url);
    ipcRenderer.on('protocol-url', wrappedCallback);

    // Return cleanup function that removes the specific wrapped callback
    return () => {
      ipcRenderer.removeListener('protocol-url', wrappedCallback);
    };
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
