import {Capacitor} from '@capacitor/core';
import {StatusBar, Style} from '@capacitor/status-bar';
import {useTheme} from '@mui/material/styles';
import type React from 'react';
import {createContext, useContext, useEffect, useState} from 'react';

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

        // Set default safe area insets for mobile platforms
        // Android typically needs 24-32px for status bar
        // iOS uses env(safe-area-inset-top) which is handled by CSS
        let topInset = 0;

        if (platform === 'android') {
          // Android status bar is typically 24dp (density-independent pixels)
          // Converting to pixels: 24dp * (dpi / 160)
          // For most modern Android devices, this is around 24-32px
          topInset = 24;

          // Try to get the actual status bar height from CSS environment variables
          // Some Android WebViews support this
          const envSafeAreaTop = getComputedStyle(
            document.documentElement
          ).getPropertyValue('env(safe-area-inset-top)');
          if (envSafeAreaTop && envSafeAreaTop !== '0px') {
            topInset = Number.parseInt(envSafeAreaTop, 10) || 24;
          }
        } else if (platform === 'ios') {
          // iOS handles safe area through CSS environment variables
          // But we'll set a fallback value
          topInset = 20; // iOS status bar minimum height
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
            color: theme.header.background as string,
          });
        }
      } catch (error) {
        console.warn('Failed to initialize status bar:', error);
        // Fallback to default safe area for mobile platforms
        if (isNativePlatform) {
          setInsets({
            top: 24, // Default safe area
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
