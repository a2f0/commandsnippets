import {act, type RenderResult, render} from '@testing-library/react';
import {createMemoryHistory, type MemoryHistory} from 'history';
import {CookiesProvider} from 'react-cookie';
import {App} from '../../src/App';
import {Router} from '../../src/lib/router/Router';

// One cookie reader for the whole test, as AppRouter (rendered once) has: a
// new options object each render would make CookiesProvider build a new
// `Cookies`, which reads `document.cookie` afresh at every navigation.
const COOKIE_OPTIONS = {path: '/'};

export interface IProps {
  history: MemoryHistory;
}

/**
 * The app in a memory router that follows `history` (a navigation renders
 * the new location). Sign in first (`signIn`) for a signed-in app.
 */
const TestAppRouter = ({history}: IProps) => (
  <Router history={history}>
    <CookiesProvider defaultSetOptions={COOKIE_OPTIONS}>
      <App />
    </CookiesProvider>
  </Router>
);

/** The app as rendered (`render`'s result), and the history it follows. */
export type RenderedApp = RenderResult & {history: MemoryHistory};

/**
 * Render the app (`TestAppRouter`) at `route`, pushed onto a new memory
 * history. With `act`, the render is awaited inside `act`: the effects it
 * starts have run when it resolves.
 */
function renderAppAt(route: string, options?: {act?: false}): RenderedApp;
function renderAppAt(route: string, options: {act: true}): Promise<RenderedApp>;
function renderAppAt(
  route: string,
  options: {act?: boolean} = {}
): RenderedApp | Promise<RenderedApp> {
  const history = createMemoryHistory();
  history.push(route);
  const app = <TestAppRouter history={history} />;
  if (options.act === true) {
    return act(async () => ({history, ...render(app)}));
  }
  return {history, ...render(app)};
}

export {renderAppAt, TestAppRouter};
