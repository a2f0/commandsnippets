import {Box, Button, Typography} from '@mui/material';
import type React from 'react';
import {useState} from 'react';

/**
 * Test component to demonstrate error boundary functionality
 * This should only be used in development/non-production environments
 */
export const ErrorTestComponent: React.FC = () => {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    // Intentionally throw an error to test the error boundary
    throw new Error(
      'This is a test error thrown by ErrorTestComponent to demonstrate error boundary functionality'
    );
  }

  return (
    <Box sx={{p: 2, border: '1px dashed orange', borderRadius: 1, m: 2}}>
      <Typography variant="h6" color="warning.main" gutterBottom>
        Error Boundary Test
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
        Click the button below to trigger an error and test the error boundary.
        The error will be captured and displayed in the HUD logs.
      </Typography>
      <Button
        variant="outlined"
        color="warning"
        onClick={() => setShouldError(true)}
        size="small"
      >
        Trigger Test Error
      </Button>
    </Box>
  );
};
