import * as Constants from './constants';
import {styled} from '@mui/material/styles';

const DragHandleContainer = styled('div')(() => ({
  display: 'inline-block',
  fontWeight: 900,
  textAlign: 'center',
  width: `${Constants.dragIndicatorWidthTag}px`,
}));

export default DragHandleContainer;
