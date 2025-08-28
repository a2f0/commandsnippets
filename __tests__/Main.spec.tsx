import '@testing-library/jest-dom';

import {ThemeProvider} from '@mui/material/styles';
import {render} from '@testing-library/react';
import invariant from 'invariant';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';
import {MemoryRouter} from 'react-router-dom';
import {describe, expect, it, vi} from 'vitest';
import {AppContextProvider} from '../src/AppContext';
import {Main} from '../src/Main';
import {darkTheme} from '../src/theme/themes';

vi.mock('react-cookie', () => ({
  useCookies: () => [{}, vi.fn(), vi.fn()],
}));

const MainWithProviders = () => (
  <ThemeProvider theme={darkTheme}>
    <MemoryRouter>
      <DndProvider backend={HTML5Backend}>
        <AppContextProvider>
          <Main />
        </AppContextProvider>
      </DndProvider>
    </MemoryRouter>
  </ThemeProvider>
);

describe('Main Component Holy Grail Layout', () => {
  it('should have flex column layout structure', () => {
    const {container} = render(<MainWithProviders />);

    const mainContainer = container.firstElementChild;
    expect(mainContainer).toBeInTheDocument();

    const computedStyles = window.getComputedStyle(mainContainer as Element);
    expect(computedStyles.display).toBe('flex');
    expect(computedStyles.flexDirection).toBe('column');
  });

  it('should use flex layout with minHeight viewport', () => {
    const {container} = render(<MainWithProviders />);

    const mainContainer = container.firstElementChild;
    const computedStyles = window.getComputedStyle(mainContainer as Element);

    expect(computedStyles.display).toBe('flex');
    expect(computedStyles.flexDirection).toBe('column');
    expect(computedStyles.minHeight).toBe('100vh');
  });

  it('should render header AppBar with sticky positioning', () => {
    const {container} = render(<MainWithProviders />);

    const appBars = container.querySelectorAll('.MuiAppBar-root');
    const headerAppBar = appBars[0];

    expect(headerAppBar).toBeInTheDocument();

    const computedStyles = window.getComputedStyle(headerAppBar as Element);
    expect(computedStyles.position).toBe('sticky');
    expect(computedStyles.top).toBe('0px');
  });

  it('should render content area with flex layout', () => {
    const {container} = render(<MainWithProviders />);

    const mainContainer = container.firstElementChild;
    const contentArea = mainContainer?.children[1];

    expect(contentArea).toBeInTheDocument();

    const computedStyles = window.getComputedStyle(contentArea as Element);
    expect(computedStyles.display).toBe('flex');
    expect(computedStyles.flex).toBe('1 1 0%');
  });

  it('should render BottomToolbar as last child with marginTop auto', () => {
    const {container} = render(<MainWithProviders />);

    const mainContainer = container.firstElementChild;
    const lastChild = mainContainer?.lastElementChild;
    expect(lastChild).toBeInTheDocument();
    expect(lastChild?.classList.contains('MuiAppBar-root')).toBe(true);

    const computedStyles = window.getComputedStyle(lastChild as Element);
    expect(computedStyles.marginTop).toBe('auto');
  });

  it('should maintain layout structure with header, content, and fixed footer', () => {
    const {container} = render(<MainWithProviders />);

    const mainContainer = container.firstElementChild;
    // Main now has 3 children: header, content, and BottomToolbar
    expect(mainContainer?.children.length).toBe(3);

    const children = Array.from(mainContainer?.children || []);
    expect(children.length).toBeGreaterThanOrEqual(2);

    const [header, content] = children;
    invariant(header, 'header is null');
    invariant(content, 'content is null');

    // Check header
    expect(header.classList.contains('MuiAppBar-root')).toBe(true);
    expect(window.getComputedStyle(header).position).toBe('sticky');

    // Check content area
    expect(window.getComputedStyle(content).display).toBe('flex');
    expect(window.getComputedStyle(content).flex).toBe('1 1 0%');

    // Check for footer with marginTop auto (Holy Grail layout)
    const appBars = container.querySelectorAll('.MuiAppBar-root');
    const footerAppBar = appBars[appBars.length - 1];
    expect(footerAppBar).toBeInTheDocument();
    expect(window.getComputedStyle(footerAppBar as Element).marginTop).toBe(
      'auto'
    );
  });
});
