import {styled} from '@mui/material/styles';
import type React from 'react';

type DragHandleContainerProps = React.HTMLAttributes<HTMLDivElement> &
  React.RefAttributes<HTMLDivElement>;

const DragHandleContainer: React.ComponentType<DragHandleContainerProps> = styled(
  'div'
)`
  display: inline-block;
  font-weight: 900;
  text-align: center;
  width: ${props => props.theme.main.dragIndicatorWidth}px;
`;

export {DragHandleContainer};
