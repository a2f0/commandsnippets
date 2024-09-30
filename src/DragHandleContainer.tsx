import {styled} from '@mui/material/styles';

const DragHandleContainer = styled('div')`
  display: inline-block;
  font-weight: 900;
  text-align: center;
  width: ${props => props.theme.main.dragIndicatorWidth}px;
`;

export default DragHandleContainer;
