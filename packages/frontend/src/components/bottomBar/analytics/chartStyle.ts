/** What the HUD's timing charts share: their colors, numbers and axes. */
import {useTheme} from '@mui/material/styles';
import {useTypedTranslation} from '../../../i18n/hooks';
import type {TimingKind} from '../../../lib/metrics/timings';

/** The kinds in legend order, which is also their color order. */
export const KINDS: readonly TimingKind[] = ['network', 'idb', 'render'];

/**
 * Each kind's color: the first three slots of a categorical palette that
 * tells them apart with any color vision, on the HUD's light and dark
 * backgrounds alike. Text never wears them: a swatch beside it does.
 */
const KIND_COLORS: Record<'light' | 'dark', Record<TimingKind, string>> = {
  light: {network: '#2a78d6', idb: '#eb6834', render: '#1baf7a'},
  dark: {network: '#3987e5', idb: '#d95926', render: '#199e70'},
};

export function useKindColors(): Record<TimingKind, string> {
  return KIND_COLORS[useTheme().palette.mode];
}

/** Each kind's name, as the legend shows it. */
export function useKindLabels(): Record<TimingKind, string> {
  const {t} = useTypedTranslation('menu');
  return {
    network: t('timingsKindNetwork'),
    idb: t('timingsKindIdb'),
    render: t('timingsKindRender'),
  };
}

/** A duration: `0 ms`, `3.4 ms`, `412 ms`, `12.3 s`. */
export function formatMs(ms: number): string {
  if (ms === 0) {
    return '0 ms';
  }
  if (ms >= 10_000) {
    return `${(ms / 1000).toFixed(1)} s`;
  }
  return ms >= 10 ? `${Math.round(ms)} ms` : `${ms.toFixed(1)} ms`;
}

/** Round ticks from 0, about `count` of them, the last at or past `max`. */
export function niceTicks(max: number, count = 5): number[] {
  if (!(max > 0)) {
    return [0, 1];
  }
  const rough = max / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map(multiple => multiple * power).find(s => s >= rough) ??
    10 * power;
  const ticks = [0];
  while ((ticks.at(-1) ?? 0) < max) {
    ticks.push(ticks.length * step);
  }
  return ticks;
}
