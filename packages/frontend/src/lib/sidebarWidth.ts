export const DEFAULT_SIDEBAR_WIDTH = 200;
export const MIN_SIDEBAR_WIDTH = 140;
export const MAX_SIDEBAR_WIDTH = 480;
export const SIDEBAR_WIDTH = `var(--tag-sidebar-width, ${DEFAULT_SIDEBAR_WIDTH}px)`;

export const maxSidebarWidth = (viewportWidth: number): number =>
  // Reserve 320px for entries and 160px for the right drawer (theme.drawer.width).
  Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, viewportWidth - 480));

export const clampSidebarWidth = (
  width: number,
  maximum = MAX_SIDEBAR_WIDTH
): number =>
  Math.min(
    maximum,
    Math.max(
      MIN_SIDEBAR_WIDTH,
      Number.isFinite(width) ? Math.round(width) : DEFAULT_SIDEBAR_WIDTH
    )
  );
