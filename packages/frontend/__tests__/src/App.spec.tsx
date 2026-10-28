import {ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {I18nextProvider} from 'react-i18next';
import {vi} from 'vitest';

import {App} from '../../src/App';
import {BottomBar} from '../../src/components/bottomBar/BottomBar';
import {useErrorStore} from '../../src/hooks/useErrorStore';
import {i18n} from '../../src/i18n/i18n';
import * as envModule from '../../src/lib/environment';
import {darkTheme} from '../../src/theme/themes';
import {signIn} from '../util/signIn';

// Every page fails to render.
vi.mock('../../src/Routes', () => ({
  Routes: () => {
    throw new Error('the page failed');
  },
}));

beforeEach(() => {
  signIn();
  vi.spyOn(envModule, 'environment', 'get').mockReturnValue('development');
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('records what its error boundary catches, which a HUD then lists', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  const {container} = render(<App />);

  // The app renders nothing in its place, the HUD included...
  expect(container).toBeEmptyDOMElement();
  expect(consoleError).toHaveBeenCalledWith(
    'ErrorBoundary caught an error:',
    expect.objectContaining({message: 'the page failed'}),
    expect.anything()
  );
  expect(useErrorStore.getState().errors).toEqual([
    expect.objectContaining({
      error: expect.objectContaining({message: 'the page failed'}),
    }),
  ]);

  // ...and a HUD mounted since lists it.
  const user = userEvent.setup();
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <BottomBar />
      </ThemeProvider>
    </I18nextProvider>
  );
  await user.click(screen.getByRole('button', {name: /Open HUD menu/i}));
  expect(
    await screen.findByText('1 log entry • 1 error captured')
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', {name: /Expand HUD/i}));
  expect(
    screen.getByText(/ERROR: Uncaught Error: the page failed/)
  ).toBeInTheDocument();
});
