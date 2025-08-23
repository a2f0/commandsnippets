import '@testing-library/jest-dom';

import {ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import {vi} from 'vitest';

import {AppContextProvider} from '../src/AppContext';
import {BottomBar} from '../src/lib/bottom_bar/BottomBar';
import * as envModule from '../src/lib/environment';
import {darkTheme} from '../src/theme/themes';

const BottomBarWithProviders = () => (
  <ThemeProvider theme={darkTheme}>
    <AppContextProvider>
      <BottomBar />
    </AppContextProvider>
  </ThemeProvider>
);

describe('BottomBar Component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['development', 'test'])('renders menu in %s environment', env => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue(env);

    render(<BottomBarWithProviders />);

    expect(screen.getByText('[menu]')).toBeInTheDocument();
  });

  it('does not render menu in production environment', () => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue('production');

    render(<BottomBarWithProviders />);

    expect(screen.queryByText('[menu]')).not.toBeInTheDocument();
  });

  it('always renders version and mode components', () => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue('production');

    render(<BottomBarWithProviders />);

    expect(screen.getByText(/\[version:/)).toBeInTheDocument();
    expect(screen.getByText(/\[mode:/)).toBeInTheDocument();
  });
});
