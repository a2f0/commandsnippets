import {
  act,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {I18nextProvider} from 'react-i18next';
import {describe, expect, it} from 'vitest';

import packageJson from '../../../../../package.json';
import {i18n} from '../../../../../src/i18n/i18n';
import {useApiVersion} from '../../../../../src/lib/api/apiVersion';
import {AboutDialog} from '../../../../../src/menu/help/menuItems/AboutDialog';
import {assignLoggedInCookie} from '../../../../util/assignLoggedInCookie';
import {serveMockApi} from '../../../../util/msw';
import {signIn} from '../../../../util/signIn';
import {renderAppAt} from '../../../../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

describe('Help Menu', () => {
  it('Is clickable', async () => {
    const user = userEvent.setup();
    renderAppAt('/test/test');
    const helpMenu = screen.getByRole('menu', {name: 'Help'});
    await user.pointer({target: helpMenu, keys: '[MouseLeft]'});
    const about = screen.getByText('About');
    await user.pointer({target: about, keys: '[MouseLeft]'});
    const dialogTitle = screen.getByText('About Command Snippets');
    expect(dialogTitle).toBeVisible();
    const dismiss = screen.getByText('Dismiss');
    await user.pointer({target: dismiss, keys: '[MouseLeft]'});
    await waitForElementToBeRemoved(() => screen.getByText('Dismiss'));
  });
});

const renderDialog = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <AboutDialog dialogOpen={true} closeDialog={() => {}} />
    </I18nextProvider>
  );

describe('AboutDialog', () => {
  beforeEach(() => useApiVersion.setState({version: null}));

  it('shows the app and API versions', () => {
    useApiVersion.setState({version: '0.2.2'});
    renderDialog();
    expect(
      screen.getByText(`App version: v${packageJson.version}`)
    ).toBeVisible();
    expect(screen.getByText('API version: v0.2.2')).toBeVisible();
    expect(screen.getByRole('link', {name: 'Privacy Policy'})).toHaveAttribute(
      'href',
      'https://commandsnippets.com/privacy/'
    );
    expect(
      screen.getByRole('link', {name: 'Terms of Service'})
    ).toHaveAttribute('href', 'https://commandsnippets.com/terms/');
    expect(
      screen.getByText('Command Snippets is operated by Tearleads, LLC.')
    ).toBeVisible();
  });

  it('says the API version is unknown until the API answers', () => {
    renderDialog();
    expect(screen.getByText('API version: unknown')).toBeVisible();
  });

  it('follows the API to a new version while open', () => {
    useApiVersion.setState({version: '0.2.1'});
    renderDialog();
    act(() => useApiVersion.setState({version: '0.2.2'}));
    expect(screen.getByText('API version: v0.2.2')).toBeVisible();
  });

  it('translates its title', async () => {
    await act(async () => {
      await i18n.changeLanguage('es');
    });
    try {
      render(
        <I18nextProvider i18n={i18n}>
          <AboutDialog dialogOpen={true} closeDialog={() => {}} />
        </I18nextProvider>
      );
      expect(screen.getByText('Acerca de Command Snippets')).toBeVisible();
      expect(
        screen.getByRole('link', {name: 'Términos del servicio'})
      ).toHaveAttribute('href', 'https://commandsnippets.com/terms/');
    } finally {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
    }
  });
});
