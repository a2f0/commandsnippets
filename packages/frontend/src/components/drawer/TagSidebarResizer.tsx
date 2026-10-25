import {Box} from '@mui/material';
import {type KeyboardEvent, type PointerEvent, useRef} from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import {
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
} from '../../lib/sidebarWidth';
import {useAppState} from '../../lib/state/appState';
import {useSidebarSizing} from './TagSidebarLayout';

export const TagSidebarResizer = () => {
  const {t} = useTypedTranslation('menu');
  const setWidth = useAppState(state => state.setTagSidebarWidth);
  const {width, maximum, preview} = useSidebarSizing();
  const drag = useRef<{pointerId: number; x: number; width: number} | null>(
    null
  );

  const dragWidth = (event: PointerEvent<HTMLDivElement>): number => {
    const start = drag.current;
    return start === null
      ? width
      : clampSidebarWidth(start.width + event.clientX - start.x, maximum);
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) {
      preview(dragWidth(event));
    }
  };

  const cancel = () => {
    drag.current = null;
    preview(null);
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number;
    switch (event.key) {
      case 'ArrowLeft':
        next = width - 10;
        break;
      case 'ArrowRight':
        next = width + 10;
        break;
      case 'Home':
        next = MIN_SIDEBAR_WIDTH;
        break;
      case 'End':
        next = maximum;
        break;
      case 'Enter':
        next = DEFAULT_SIDEBAR_WIDTH;
        break;
      case 'Tab':
        // Allow native focus traversal instead of the lists' Tab shortcut.
        event.stopPropagation();
        return;
      default:
        return;
    }
    // Handled resize keys must not also navigate the lists.
    event.stopPropagation();
    event.preventDefault();
    setWidth(clampSidebarWidth(next, maximum));
  };

  return (
    <Box
      role="separator"
      tabIndex={0}
      aria-label={t('resizeTagSidebar')}
      aria-orientation="vertical"
      aria-controls="tagSidebar"
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={maximum}
      aria-valuenow={width}
      onKeyDown={keyDown}
      onDoubleClick={() => setWidth(DEFAULT_SIDEBAR_WIDTH)}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {pointerId: event.pointerId, x: event.clientX, width};
      }}
      onPointerMove={move}
      onPointerUp={(event: PointerEvent<HTMLDivElement>) => {
        if (drag.current?.pointerId === event.pointerId) {
          // A click alone must not replace a wider preference while the
          // current viewport temporarily clamps it.
          if (event.clientX !== drag.current.x) setWidth(dragWidth(event));
          cancel();
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      sx={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: 'col-resize',
        touchAction: 'none',
        userSelect: 'none',
        zIndex: 1,
        borderRight: 1,
        borderColor: 'divider',
        '&:hover, &:focus-visible': {backgroundColor: 'action.selected'},
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'text.secondary',
          outlineOffset: -2,
        },
      }}
    />
  );
};
