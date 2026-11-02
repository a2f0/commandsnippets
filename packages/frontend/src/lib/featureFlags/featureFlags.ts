/**
 * Whether each feature flag (`flags.ts`) is on: its default for the
 * environment, unless this device overrides it. Overrides are saved to
 * localStorage per environment and shared by every tab; production ignores
 * them, so production users always get the defaults.
 *
 * The environment is read at each call (never once at load), as a test may
 * change it between renders.
 */

import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {environment} from '../environment';
import {type FeatureFlag, isDefaultEnabled} from './flags';

export type FeatureFlagOverrides = Partial<Record<FeatureFlag, boolean>>;

interface FeatureFlagState {
  overrides: FeatureFlagOverrides;
}

export const FEATURE_FLAGS_STORAGE_KEY = `commandsnippets-${environment}-feature-flags`;

export const useFeatureFlagStore = create<FeatureFlagState>()(
  persist((): FeatureFlagState => ({overrides: {}}), {
    name: FEATURE_FLAGS_STORAGE_KEY,
    storage: createJSONStorage(() => localStorage),
    version: 1,
  })
);

// Another tab's change of an override applies here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === FEATURE_FLAGS_STORAGE_KEY) {
      void useFeatureFlagStore.persist.rehydrate();
    }
  });
}

/** Whether flags can be overridden here: everywhere but production. */
export const canOverrideFeatureFlags = (): boolean =>
  environment !== 'production';

/** Whether `flag` is on in this environment when not overridden. */
export const featureFlagDefault = (flag: FeatureFlag): boolean =>
  isDefaultEnabled(flag, environment);

/** This device's override of `flag`, if it has one that applies. */
export const featureFlagOverride = (
  flag: FeatureFlag,
  overrides: FeatureFlagOverrides = useFeatureFlagStore.getState().overrides
): boolean | undefined => {
  if (!canOverrideFeatureFlags()) {
    return undefined;
  }
  const value = overrides[flag];
  // Saved state is read back as is: anything but a boolean is no override.
  return typeof value === 'boolean' ? value : undefined;
};

const resolve = (flag: FeatureFlag, overrides: FeatureFlagOverrides) =>
  featureFlagOverride(flag, overrides) ?? featureFlagDefault(flag);

/** Whether `flag` is on, for code outside React. */
export const isFeatureEnabled = (flag: FeatureFlag): boolean =>
  resolve(flag, useFeatureFlagStore.getState().overrides);

/** Whether `flag` is on; renders again when its override changes. */
export const useFeatureFlag = (flag: FeatureFlag): boolean =>
  useFeatureFlagStore(state => resolve(flag, state.overrides));

/**
 * Override `flag` on this device (`null` goes back to the default). Does
 * nothing in production, which uses the defaults.
 */
export const setFeatureFlagOverride = (
  flag: FeatureFlag,
  enabled: boolean | null
): void => {
  if (!canOverrideFeatureFlags()) {
    return;
  }
  useFeatureFlagStore.setState(({overrides}) => {
    const next = {...overrides};
    if (enabled === null) {
      delete next[flag];
    } else {
      next[flag] = enabled;
    }
    return {overrides: next};
  });
};

/** Every flag back to its default on this device. */
export const resetFeatureFlagOverrides = (): void => {
  useFeatureFlagStore.setState({overrides: {}});
};
