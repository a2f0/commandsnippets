import {Box} from '@mui/material';
import React from 'react';

interface IProps {
  children?: React.ReactNode;
  id: string;
  ref?: React.Ref<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onFocusCapture?: React.FocusEventHandler<HTMLDivElement>;
}

const StyledTagFormContainer = ({children, ...props}: IProps) => {
  return (
    <Box
      {...props}
      sx={{
        width: theme => `100% - ${theme.main.dragIndicatorWidth}px`,
        ml: theme => `${theme.main.dragIndicatorWidth}px`,
      }}
    >
      {children}
    </Box>
  );
};

const MemoizedStyledTagFormContainer = React.memo(StyledTagFormContainer);

export {MemoizedStyledTagFormContainer as StyledTagFormContainer};
