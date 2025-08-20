import '@testing-library/jest-dom';

import {ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import {vi} from 'vitest';
import {AppContext} from '../../../../src/AppContext';
import {defaultState} from '../../../../src/lib/shared';
import {createAppStateStore} from '../../../../src/lib/store/store';
import {InputEntrySubject} from '../../../../src/styled/text_entries/InputEntrySubject';
import {darkTheme} from '../../../../src/theme/themes';

const mockStore = createAppStateStore({
  ...defaultState,
  loggedInUser: 'test',
});

describe('InputEntrySubject', () => {
  const defaultProps = {
    handleChangeParent: vi.fn(),
    placeholder: 'Enter subject',
    valueParent: 'Test value',
    id: 'test-input',
  };

  it('should render with autoComplete disabled', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <AppContext.Provider value={mockStore}>
          <InputEntrySubject {...defaultProps} />
        </AppContext.Provider>
      </ThemeProvider>
    );

    const input = screen.getByPlaceholderText('Enter subject');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('should render with correct placeholder and value', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <AppContext.Provider value={mockStore}>
          <InputEntrySubject {...defaultProps} />
        </AppContext.Provider>
      </ThemeProvider>
    );

    const input = screen.getByPlaceholderText('Enter subject');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Test value');
  });
});
