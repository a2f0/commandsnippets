import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {
  isFeatureEnabled,
  setFeatureFlagOverride,
} from '../../../../../src/lib/featureFlags/featureFlags';
import {assignLoggedInCookie} from '../../../../util/assignLoggedInCookie';
import {serveMockApi} from '../../../../util/msw';
import {observeSyncWork} from '../../../../util/observeSyncWork';
import {signIn, TEST_USER} from '../../../../util/signIn';
import {renderAppAt} from '../../../../util/TestAppRouter';

serveMockApi();
let syncWork: ReturnType<typeof observeSyncWork>;
// Finish the mounted fixture before MSW removes its handlers and DB reset.
afterEach(async () => {
  await syncWork.finish();
  expect(syncWork.syncAll).toHaveBeenCalledTimes(1);
});
beforeEach(() => {
  signIn();
  syncWork = observeSyncWork(TEST_USER);
  assignLoggedInCookie();
});

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('menu', {name: 'Debug'}));
  await user.click(screen.getByText('Feature Flags'));
  return screen.findByRole('dialog', {name: 'Feature Flags'});
};

describe('Debug > Feature Flags', () => {
  it('lists every flag as on by default here', async () => {
    const user = userEvent.setup();
    await renderAppAt('/test/test', {act: true});
    const dialog = await openDialog(user);

    for (const name of [
      'HUD and timings',
      'Language switcher',
      'User profile menu',
    ]) {
      expect(within(dialog).getByRole('switch', {name})).toBeChecked();
    }
    expect(within(dialog).getAllByText('Default (On)')).toHaveLength(3);
    expect(
      within(dialog).getByRole('button', {name: 'Reset to Defaults'})
    ).toBeDisabled();
  });

  it('turns a feature off on this device, and resets it', async () => {
    const user = userEvent.setup();
    await renderAppAt('/test/test', {act: true});
    expect(screen.getByText('[HUD]')).toBeInTheDocument();
    const dialog = await openDialog(user);

    await user.click(
      within(dialog).getByRole('switch', {name: 'HUD and timings'})
    );
    expect(isFeatureEnabled('hud')).toBe(false);
    expect(
      within(dialog).getByText('Overridden on this device (default On)')
    ).toBeVisible();
    expect(screen.queryByText('[HUD]')).not.toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', {name: 'Reset to Defaults'})
    );
    expect(isFeatureEnabled('hud')).toBe(true);
    expect(screen.getByText('[HUD]')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', {name: 'Close'}));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {name: 'Feature Flags'})
      ).not.toBeInTheDocument()
    );
  });

  it('hides the user profile menu when its flag is off', async () => {
    setFeatureFlagOverride('userProfileMenu', false);
    await renderAppAt('/test/test', {act: true});
    expect(screen.getByRole('menu', {name: 'File'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'test'})
    ).not.toBeInTheDocument();
  });
});
