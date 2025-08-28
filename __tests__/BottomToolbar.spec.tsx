import '@testing-library/jest-dom';

import {ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {AppContextProvider} from '../src/AppContext';
import {BottomToolbar} from '../src/components/BottomToolbar';
import {darkTheme} from '../src/theme/themes';

const BottomToolbarWithProviders = () => (
  <ThemeProvider theme={darkTheme}>
    <AppContextProvider>
      <BottomToolbar />
    </AppContextProvider>
  </ThemeProvider>
);

describe('BottomToolbar Holy Grail Layout', () => {
  it('should use sticky positioning with marginTop auto', () => {
    const {container} = render(<BottomToolbarWithProviders />);

    const appBar = container.querySelector('.MuiAppBar-root');
    expect(appBar).toBeInTheDocument();

    const computedStyles = window.getComputedStyle(appBar as Element);
    expect(computedStyles.marginTop).toBe('auto');
  });

  it('should render with proper MUI AppBar classes', () => {
    const {container} = render(<BottomToolbarWithProviders />);

    const appBar = container.querySelector('.MuiAppBar-root');
    expect(appBar).toBeInTheDocument();
    expect(appBar?.classList.contains('MuiAppBar-positionSticky')).toBe(true);
  });

  it('should contain the BottomBar component', () => {
    render(<BottomToolbarWithProviders />);

    // Check for version and mode components which are always present
    expect(screen.getByText(/\[version:/)).toBeInTheDocument();
    expect(screen.getByText(/\[mode:/)).toBeInTheDocument();
  });

  it('should have correct background styling', () => {
    const {container} = render(<BottomToolbarWithProviders />);

    const appBar = container.querySelector('.MuiAppBar-root');
    expect(appBar).toBeInTheDocument();

    const computedStyles = window.getComputedStyle(appBar as Element);
    expect(computedStyles.backgroundImage).toBe('none');
  });

  it('should stick to bottom with flex layout and marginTop auto', () => {
    const {container} = render(
      <div
        style={{display: 'flex', flexDirection: 'column', minHeight: '100vh'}}
      >
        <div>Header</div>
        <div style={{flex: 1}}>Content</div>
        <BottomToolbarWithProviders />
      </div>
    );

    const appBar = container.querySelector('.MuiAppBar-root');
    const computedStyles = window.getComputedStyle(appBar as Element);
    expect(computedStyles.marginTop).toBe('auto');
  });
});
