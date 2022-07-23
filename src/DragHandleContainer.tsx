import {styled} from '@mui/material/styles';

const DragHandleContainer = styled('div')(
  ({theme}) => `
  display: inline-block;
  font-weight: 900;
  text-align: center;
  width: ${theme.main.dragIndicatorWidth}px;
`
);

export default DragHandleContainer;
