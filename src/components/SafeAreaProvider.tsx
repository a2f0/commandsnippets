import {Capacitor} from '@capacitor/core';
import {StatusBar, Style} from '@capacitor/status-bar';
import {useTheme} from '@mui/material/styles';
import type React from 'react';
import {createContext, useContext, useEffect, useState} from 'react';

const ANDROID_FALLBACK_INSET = 24;
const IOS_FALLBACK_INSET = 20;

interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface SafeAreaContextType {
  insets: SafeAreaInsets;
  isNativePlatform: boolean;
}

const SafeAreaContext = createContext<SafeAreaContextType>({
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  isNativePlatform: false,
});

export const useSafeArea = () => useContext(SafeAreaContext);

interface SafeAreaProviderProps {
  children: React.ReactNode;
}

export const SafeAreaProvider: React.FC<SafeAreaProviderProps> = ({
  children,
}) => {
  const theme = useTheme();
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  const isNativePlatform = Capacitor.isNativePlatform();

  useEffect(() => {
    const initializeStatusBar = async () => {
      if (!isNativePlatform) {
        return;
      }

      try {
        const platform = Capacitor.getPlatform();

        let topInset = 0;
        if (platform === 'android') {
          topInset = ANDROID_FALLBACK_INSET;
        } else if (platform === 'ios') {
          topInset = IOS_FALLBACK_INSET;
        }

        // Try to get the actual status bar height from CSS environment variables
        const envSafeAreaTop = getComputedStyle(
          document.documentElement
        ).getPropertyValue('env(safe-area-inset-top)');
        if (envSafeAreaTop && envSafeAreaTop !== '0px') {
          topInset = Number.parseInt(envSafeAreaTop, 10) || topInset;
        }

        setInsets({
          top: topInset,
          bottom: 0,
          left: 0,
          right: 0,
        });

        // Set status bar style based on theme
        const isDarkMode = theme.palette.mode === 'dark';
        await StatusBar.setStyle({
          style: isDarkMode ? Style.Dark : Style.Light,
        });

        // Make status bar translucent on Android for better appearance
        if (platform === 'android') {
          await StatusBar.setOverlaysWebView({overlay: true});
          // Set background color to match the app bar
          await StatusBar.setBackgroundColor({
            color: theme.header.background,
          });
        }
      } catch (error) {
        console.warn('Failed to initialize status bar:', error);
        // Fallback to default safe area for mobile platforms
        if (isNativePlatform) {
          const platform = Capacitor.getPlatform();
          const fallbackInset =
            platform === 'ios' ? IOS_FALLBACK_INSET : ANDROID_FALLBACK_INSET;
          setInsets({
            top: fallbackInset,
            bottom: 0,
            left: 0,
            right: 0,
          });
        }
      }
    };

    initializeStatusBar();
  }, [isNativePlatform, theme]);

  return (
    <SafeAreaContext.Provider value={{insets, isNativePlatform}}>
      {children}
    </SafeAreaContext.Provider>
  );
};
