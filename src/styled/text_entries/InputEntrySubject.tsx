import * as Constants from '../../constants';
import React, {useEffect, useRef, useState} from 'react';
import TextField from '@mui/material/TextField';
import {Theme} from '@mui/material/styles';
import {activeEntryEditField} from '../../../src/lib/shared';
import {observer} from 'mobx-react';
import {useAppContext} from '../../AppContext';
import {useTheme} from '@mui/material/styles';

export interface IProps {
  handleChangeParent: (value: string) => void;
  placeholder: string;
  valueParent: string;
  id: string;
}

const InputEntrySubject = ({
  handleChangeParent,
  valueParent,
  placeholder,
  id,
}: IProps) => {
  const inputRef = useRef<HTMLInputElement>();
  const [value, setValue] = useState<string>(valueParent);
  const theme: Theme = useTheme();
  const appConfig = useAppContext();

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    handleChangeParent(event.target.value);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    appConfig.setActiveEntryEditField(activeEntryEditField.subject);
  };

  useEffect(() => {
    if (appConfig.activeEntryEditField === activeEntryEditField.subject) {
      inputRef.current?.focus();
    }
  }, [appConfig.activeEntryEditField]);

  const setTextInputRef = (element: HTMLInputElement) => {
    inputRef.current = element;
  };

  return (
    <TextField
      id={id}
      sx={{
        width: `calc(100% - (${Constants.drawerWidth}px))`,
        minWidth: `calc(100% - (${Constants.drawerWidth}px))`,
        maxWidth: `calc(100% - (${Constants.drawerWidth}px))`,
        marginLeft: 0,
        marginBottom: '4px',
        background: theme => `${theme.textInput.background}`,
        '& .Mui-focused': {
          border: `2px solid ${theme.palette.secondary.main}`,
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
        },
      }}
      type="text"
      inputProps={{
        style: {
          fontSize: 13,
          paddingLeft: 4,
          paddingBottom: 4,
          paddingTop: 4,
        },
      }}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      onClick={handleClick}
      inputRef={setTextInputRef}
    />
  );
};
export default React.memo(observer(InputEntrySubject));
