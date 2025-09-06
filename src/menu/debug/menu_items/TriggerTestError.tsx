import React, {useState} from 'react';

import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const TriggerTestError = ({onClose}: IProps) => {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    // Reset the state so it doesn't keep throwing
    setShouldError(false);
    // Throw an error to test the error boundary
    throw new Error(
      'Test error triggered from Debug menu to demonstrate error boundary functionality'
    );
  }

  const handleClick = () => {
    // Close the menu first
    onClose();
    // Schedule the error to be thrown after menu closes
    setTimeout(() => {
      setShouldError(true);
    }, 100);
  };

  return (
    <StyledMenuItem
      id="debug-menu-trigger-test-error"
      key="Trigger Test Error"
      onClick={handleClick}
    >
      Trigger Test Error
    </StyledMenuItem>
  );
};

const memoizedTriggerTestError = React.memo(TriggerTestError);
export {memoizedTriggerTestError as TriggerTestError};
