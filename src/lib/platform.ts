import {Capacitor} from '@capacitor/core';

export const isElectron = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    window.electron?.process?.versions?.electron !== undefined
  );
};

export const isCapacitor = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const isWeb = (): boolean => {
  return !isElectron() && !isCapacitor();
};

export const getPlatform = (): 'electron' | 'capacitor' | 'web' => {
  if (isElectron()) return 'electron';
  if (isCapacitor()) return 'capacitor';
  return 'web';
};
