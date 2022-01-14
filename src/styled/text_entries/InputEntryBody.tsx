import * as Constants from '../../constants';
import React, {useState} from 'react';
import TextareaAutosize from '@mui/material/TextareaAutosize';
import {Theme} from '@mui/material/styles';
import styled from '@emotion/styled';
import {useTheme} from '@mui/styles';

export interface StyledTextAreaIProps {
  theme: Theme;
}

const StyledTextareaAutosize = styled(TextareaAutosize)<StyledTextAreaIProps>`
  width: calc(100% - (${Constants.drawerWidth}px));
  min-width: calc(100% - (${Constants.drawerWidth}px));
  max-width: calc(100% - (${Constants.drawerWidth}px));
  background: ${props => props.theme.textInput.background};
  padding-left: 4px;
  color: ${props => props.theme.palette.text.primary};
  &:hover {
    border: 1px solid ${props => props.theme.palette.secondary.main};
  }
  &:focus {
    border: 2px solid ${props => props.theme.palette.secondary.main};
    outline: none;
  }
`;

export interface IProps {
  handleChangeParent: (value: string) => void;
  placeholder: string;
  valueParent: string;
  id: string;
}

const InputEntryBody = ({
  handleChangeParent,
  valueParent,
  placeholder,
  id,
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
    } else {
      return lines.length + 5;
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <StyledTextareaAutosize
      id={id}
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
export default React.memo(InputEntryBody);
