import {styled} from '@mui/material/styles';
import React from 'react';

type DragHandleContainerProps = React.HTMLAttributes<HTMLDivElement> &
  React.RefAttributes<HTMLDivElement>;

const DragHandleContainerBase = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const refValue = ref;
  return <div {...props} ref={refValue} />;
});

const DragHandleContainer: React.ComponentType<DragHandleContainerProps> = styled(
  DragHandleContainerBase
)`
  display: inline-block;
  font-weight: 900;
  text-align: center;
  width: ${props => props.theme.main.dragIndicatorWidth}px;
`;

export {DragHandleContainer};
