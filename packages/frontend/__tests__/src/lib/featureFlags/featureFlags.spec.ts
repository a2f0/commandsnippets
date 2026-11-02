import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {
  canOverrideFeatureFlags,
  FEATURE_FLAGS_STORAGE_KEY,
  featureFlagDefault,
  isFeatureEnabled,
  resetFeatureFlagOverrides,
  setFeatureFlagOverride,
  useFeatureFlag,
  useFeatureFlagStore,
} from '../../../../src/lib/featureFlags/featureFlags';
import {
  FEATURE_FLAG_NAMES,
  FEATURE_FLAGS,
} from '../../../../src/lib/featureFlags/flags';
import {isRecording} from '../../../../src/lib/metrics/timings';
import {stubEnvironment} from '../../../util/environment';

afterEach(() => resetFeatureFlagOverrides());

describe('feature flags', () => {
  it('defines every flag it names', () => {
    expect(Object.keys(FEATURE_FLAGS).sort()).toEqual(
      [...FEATURE_FLAG_NAMES].sort()
    );
  });

  it.each(['development', 'test', 'staging'])(
    'turns every flag on by default in %s',
    environment => {
      stubEnvironment(environment);
      for (const flag of FEATURE_FLAG_NAMES) {
        expect(featureFlagDefault(flag)).toBe(true);
        expect(isFeatureEnabled(flag)).toBe(true);
      }
    }
  );

  it('turns every flag off by default in production', () => {
    stubEnvironment('production');
    for (const flag of FEATURE_FLAG_NAMES) {
      expect(isFeatureEnabled(flag)).toBe(false);
    }
  });

  it('overrides a flag on this device, and back to its default', () => {
    stubEnvironment('staging');
    setFeatureFlagOverride('hud', false);
    expect(isFeatureEnabled('hud')).toBe(false);
    expect(isFeatureEnabled('languageSwitcher')).toBe(true);
    setFeatureFlagOverride('hud', null);
    expect(isFeatureEnabled('hud')).toBe(true);
  });

  it('saves overrides per environment', () => {
    setFeatureFlagOverride('languageSwitcher', false);
    expect(FEATURE_FLAGS_STORAGE_KEY).toBe(
      'commandsnippets-test-feature-flags'
    );
    const saved = localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
    expect(saved === null ? null : JSON.parse(saved).state).toEqual({
      overrides: {languageSwitcher: false},
    });
  });

  it('ignores overrides in production, and refuses new ones', () => {
    setFeatureFlagOverride('hud', true);
    stubEnvironment('production');
    expect(canOverrideFeatureFlags()).toBe(false);
    expect(isFeatureEnabled('hud')).toBe(false);
    setFeatureFlagOverride('userProfileMenu', true);
    expect(useFeatureFlagStore.getState().overrides).toEqual({hud: true});
  });

  it('treats a saved value that is not a boolean as no override', () => {
    useFeatureFlagStore.setState({
      overrides: JSON.parse('{"hud": "off"}'),
    });
    expect(isFeatureEnabled('hud')).toBe(true);
  });

  it('takes up an override saved by another tab', async () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify({state: {overrides: {hud: false}}, version: 1})
    );
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {key: FEATURE_FLAGS_STORAGE_KEY})
      );
      await Promise.resolve();
    });
    expect(isFeatureEnabled('hud')).toBe(false);
  });

  it('renders again when an override changes', () => {
    const {result} = renderHook(() => useFeatureFlag('userProfileMenu'));
    expect(result.current).toBe(true);
    act(() => setFeatureFlagOverride('userProfileMenu', false));
    expect(result.current).toBe(false);
    act(() => resetFeatureFlagOverrides());
    expect(result.current).toBe(true);
  });

  it('records timings only while the HUD is on', () => {
    expect(isRecording()).toBe(true);
    setFeatureFlagOverride('hud', false);
    expect(isRecording()).toBe(false);
  });
});
