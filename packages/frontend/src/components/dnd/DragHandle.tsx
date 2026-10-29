import {styled} from '@mui/material/styles';
import type React from 'react';

type DragHandleProps = React.HTMLAttributes<HTMLDivElement> &
  React.RefAttributes<HTMLDivElement>;

/** Where a row's drag starts: its ref is the div's (React DnD's source). */
const DragHandle: React.ComponentType<DragHandleProps> = styled('div')(() => ({
  cursor: 'grab',
}));

export {DragHandle};
