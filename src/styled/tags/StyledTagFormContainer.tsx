import * as Constants from '../../constants';
import React from 'react';

const style = {
  marginLeft: `${Constants.dragIndicatorWidthTag}px`,
  width: `100% - ${Constants.dragIndicatorWidthTag}px`,
};

interface IProps {
  children?: React.ReactNode;
  id: string;
}

const StyledTagFormContainer = ({children, id}: IProps) => {
  return (
    <div id={id} style={style}>
      {children}
    </div>
  );
};
export default React.memo(StyledTagFormContainer);
