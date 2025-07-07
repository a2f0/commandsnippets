import React from 'react';
import {styled} from '@mui/material/styles';

type DragHandleProps = React.HTMLAttributes<HTMLDivElement> &
  React.RefAttributes<HTMLDivElement>;

const DragHandleBase = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => <div {...props} ref={ref} />);

const DragHandle: React.ComponentType<DragHandleProps> = styled(DragHandleBase)(
  () => ({
    cursor: 'grab',
  })
);

export {DragHandle};
