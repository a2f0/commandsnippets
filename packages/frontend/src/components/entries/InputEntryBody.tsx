import styled from '@emotion/styled';
import {TextareaAutosize} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import React, {useState} from 'react';
import type {Theme} from '../../theme/themes';

interface StyledTextAreaIProps {
  theme: Theme;
}

const StyledTextareaAutosize = styled(TextareaAutosize)<StyledTextAreaIProps>`
  width: calc(100% - (${props => props.theme.drawer.width}px));
  min-width: calc(100% - (${props => props.theme.drawer.width}px));
  max-width: calc(100% - (${props => props.theme.drawer.width}px));
  padding-left: 4px;
  color: ${props => props.theme.palette.text.primary};
  background-color: ${props => props.theme.palette.background.default};
  font-size: 13.333px;
  border-radius: 0px;
  /* The border is 1px in every state: the autosize counts it in the height,
     so a thicker one would move what is below. Focus thickens it inward with
     a shadow, which takes no space. */
  border-width: 1px;
  border-style: solid;
  &:hover {
    border-color: ${props => props.theme.palette.text.primary};
  }
  &:focus {
    border-color: ${props => props.theme.palette.text.primary};
    box-shadow: inset 0 0 0 1px ${props => props.theme.palette.text.primary};
    outline: none;
  }
`;

interface IProps {
  handleChangeParent: (value: string) => void;
  placeholder: string;
  valueParent: string;
  id: string;
  readOnly?: boolean;
}

const InputEntryBody = ({
  handleChangeParent,
  valueParent,
  placeholder,
  id,
  readOnly = false,
}: IProps) => {
  const [value, setValue] = useState<string>(valueParent);

  const theme = useTheme<Theme>();

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    handleChangeParent(event.target.value);
  };

  const minRows = (value: string): number => {
    const lines = value.split('\n');
    if (lines.length < 20) {
      return 20;
    }
    return lines.length + 5;
  };

  const handleClick = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <StyledTextareaAutosize
      id={id}
      readOnly={readOnly}
      onClick={handleClick}
      theme={theme}
      spellCheck="false"
      placeholder={placeholder}
      value={value}
      minRows={minRows(value)}
      onChange={handleChange}
    />
  );
};

const memoizedInputEntryBody = React.memo(InputEntryBody);

export {memoizedInputEntryBody as InputEntryBody};
