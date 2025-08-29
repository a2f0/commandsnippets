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
  it('should have a flex column layout filling the viewport', () => {
    const {container} = render(<MainWithProviders />);

    const mainContainer = container.firstElementChild;
    expect(mainContainer).toBeInTheDocument();

    invariant(mainContainer, 'mainContainer should exist');
    const computedStyles = window.getComputedStyle(mainContainer);
    expect(computedStyles.display).toBe('flex');
    expect(computedStyles.flexDirection).toBe('column');
    expect(computedStyles.minHeight).toBe('100vh');
  });

  it('should render header AppBar with sticky positioning', () => {
    const {container} = render(<MainWithProviders />);

    const appBars = container.querySelectorAll('.MuiAppBar-root');
    const headerAppBar = appBars[0];

    expect(headerAppBar).toBeInTheDocument();

invariant(headerAppBar, 'The headerAppBar element (appBars[0]) should exist');
    const computedStyles = window.getComputedStyle(headerAppBar);
    expect(computedStyles.position).toBe('sticky');
    expect(computedStyles.top).toBe('0px');
  });

  it('should render content area with flex layout', () => {
    const {container} = render(<MainWithProviders />);

    const mainContainer = container.firstElementChild;
    const contentArea = mainContainer?.children[1];

    expect(contentArea).toBeInTheDocument();

invariant(contentArea, 'The contentArea element (mainContainer.children[1]) should exist');
    const computedStyles = window.getComputedStyle(contentArea);
    expect(computedStyles.display).toBe('flex');
    expect(computedStyles.flex).toBe('1 1 0%');
  });

  it('should render BottomToolbar as last child with marginTop auto', () => {
    const {container} = render(<MainWithProviders />);

    const mainContainer = container.firstElementChild;
    const lastChild = mainContainer?.lastElementChild;
    expect(lastChild).toBeInTheDocument();
    expect(lastChild?.classList.contains('MuiAppBar-root')).toBe(true);

invariant(lastChild, 'The lastChild element (mainContainer.lastElementChild) should exist');
    const computedStyles = window.getComputedStyle(lastChild);
    expect(computedStyles.marginTop).toBe('auto');
  });

  it('should maintain layout structure with header, content, and fixed footer', () => {
    const {container} = render(<MainWithProviders />);

    const mainContainer = container.firstElementChild;
    expect(mainContainer).toBeInTheDocument();
    invariant(mainContainer, 'mainContainer should exist');
    expect(mainContainer.children.length).toBe(3);

    const [header, content, footer] = Array.from(mainContainer.children);
    invariant(header, 'header should exist');
    invariant(content, 'content should exist');
    invariant(footer, 'footer should exist');

    // Check header
    expect(header.classList.contains('MuiAppBar-root')).toBe(true);
    expect(window.getComputedStyle(header).position).toBe('sticky');

    // Check content area
    expect(window.getComputedStyle(content).display).toBe('flex');
    expect(window.getComputedStyle(content).flex).toBe('1 1 0%');

    // Check footer
    expect(footer.classList.contains('MuiAppBar-root')).toBe(true);
    expect(window.getComputedStyle(footer).marginTop).toBe('auto');
  });
});
