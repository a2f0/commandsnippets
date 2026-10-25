import {Box} from '@mui/material';
import {type KeyboardEvent, type PointerEvent, useRef} from 'react';
import {useWindowSize} from '../../hooks/useWindowSize';
import {useTypedTranslation} from '../../i18n/hooks';
import {
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  maxSidebarWidth,
} from '../../lib/sidebarWidth';
import {useAppState} from '../../lib/state/appState';

export const TagSidebarResizer = () => {
  const {t} = useTypedTranslation('menu');
  const savedWidth = useAppState(state => state.tagSidebarWidth);
  const setWidth = useAppState(state => state.setTagSidebarWidth);
  const {width: viewportWidth} = useWindowSize();
  const maximum = maxSidebarWidth(viewportWidth);
  const width = clampSidebarWidth(savedWidth, maximum);
  const drag = useRef<{pointerId: number; x: number; width: number} | null>(
    null
  );

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) {
      setWidth(
        clampSidebarWidth(
          drag.current.width + event.clientX - drag.current.x,
          maximum
        )
      );
    }
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Keep the list shortcuts from taking focus away from the separator.
    event.stopPropagation();
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
      default:
        return;
    }
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
        move(event);
        if (drag.current?.pointerId === event.pointerId) {
          drag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
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
