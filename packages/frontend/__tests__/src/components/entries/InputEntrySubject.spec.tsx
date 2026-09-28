import {ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import {vi} from 'vitest';
import {InputEntrySubject} from '../../../../src/components/entries/InputEntrySubject';
import {darkTheme} from '../../../../src/theme/themes';
import {LoggedInAppContextProvider} from '../../../util/LoggedInAppContextProvider';

describe('InputEntrySubject', () => {
  const defaultProps = {
    handleChangeParent: vi.fn(),
    placeholder: 'Enter subject',
    valueParent: 'Test value',
    id: 'test-input',
  };

  beforeEach(() => {
    render(
      <ThemeProvider theme={darkTheme}>
        <LoggedInAppContextProvider>
          <InputEntrySubject {...defaultProps} />
        </LoggedInAppContextProvider>
      </ThemeProvider>
    );
  });

  it('should render with autoComplete disabled', () => {
    const input = screen.getByPlaceholderText('Enter subject');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('should render with correct placeholder and value', () => {
    const input = screen.getByPlaceholderText('Enter subject');
    expect(input).toHaveValue('Test value');
  });
});
