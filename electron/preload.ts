import {electronAPI} from '@electron-toolkit/preload';
import {contextBridge, ipcRenderer} from 'electron';

// Custom APIs for renderer
const api = {
  onProtocolUrl: (callback: (url: string) => void) => {
    ipcRenderer.on('protocol-url', (_, url) => callback(url));
  },
  removeProtocolUrlListener: () => {
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
