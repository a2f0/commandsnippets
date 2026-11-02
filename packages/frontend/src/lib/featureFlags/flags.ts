/**
 * The app's feature flags: every flag, and the environments it is on in by
 * default. A flag gates a feature in one place (`useFeatureFlag` in
 * components, `isFeatureEnabled` elsewhere), never an inline check of the
 * environment. Outside production, Debug > Feature Flags overrides a flag on
 * this device (`featureFlags.ts`); production always uses the defaults.
 *
 * To add a flag: name it here, give it its default environments, and name it
 * for the Debug menu's dialog (`featureFlagNameKeys` in
 * `src/menu/debug/menuItems/FeatureFlagsDialog.tsx`, and the translations).
 * Remove a flag, and its checks, once its feature ships everywhere.
 */

/** The environments `src/lib/environment.ts` tells apart. */
export type Environment = 'development' | 'test' | 'staging' | 'production';

export const FEATURE_FLAG_NAMES = [
  'hud',
  'languageSwitcher',
  'userProfileMenu',
] as const;

export type FeatureFlag = (typeof FEATURE_FLAG_NAMES)[number];

export interface FeatureFlagDefinition {
  /** The environments the flag is on in unless overridden. */
  readonly environments: readonly Environment[];
}

/** Everywhere but production: features still being tried out. */
const PRE_PRODUCTION: readonly Environment[] = [
  'development',
  'test',
  'staging',
];

export const FEATURE_FLAGS: Readonly<
  Record<FeatureFlag, FeatureFlagDefinition>
> = {
  // The bottom bar's HUD (logs and timings), and the timings it shows
  // (`lib/metrics/timings.ts` records nothing while it is off).
  hud: {environments: PRE_PRODUCTION},
  // The bottom bar's language menu.
  languageSwitcher: {environments: PRE_PRODUCTION},
  // The signed-in user's avatar menu in the menu bar.
  userProfileMenu: {environments: PRE_PRODUCTION},
};

/** Whether `flag` is on in `environment` when not overridden. */
export const isDefaultEnabled = (
  flag: FeatureFlag,
  environment: string
): boolean =>
  FEATURE_FLAGS[flag].environments.some(name => name === environment);
