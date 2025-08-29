import '@testing-library/jest-dom';

import {ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import invariant from 'invariant';
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
  it('should have sticky positioning and auto margin', () => {
    const {container} = render(<BottomToolbarWithProviders />);

    const appBar = container.querySelector('.MuiAppBar-root');
    expect(appBar).toBeInTheDocument();
    expect(appBar?.classList.contains('MuiAppBar-positionSticky')).toBe(true);

    invariant(appBar, 'appBar should exist');
    const computedStyles = window.getComputedStyle(appBar);
    expect(computedStyles.marginTop).toBe('auto');
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

    invariant(appBar, 'appBar should exist');
    const computedStyles = window.getComputedStyle(appBar);
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
    invariant(appBar, 'appBar should exist');
    const computedStyles = window.getComputedStyle(appBar);
    expect(computedStyles.marginTop).toBe('auto');
  });
});
