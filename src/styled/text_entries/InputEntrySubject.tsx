import {TextField} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {useTheme} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React, {useEffect, useRef, useState} from 'react';

import {activeEntryEditField} from '../../../src/lib/shared';
import {useAppContext} from '../../AppContext';

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
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  const setTextInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element;
  };

  return (
    <TextField
      id={id}
      sx={{
        width: `calc(100% - (${theme.drawer.width}px))`,
        minWidth: `calc(100% - (${theme.drawer.width}px))`,
        maxWidth: `calc(100% - (${theme.drawer.width}px))`,
        marginLeft: 0,
        marginBottom: '4px',
        '& .MuiOutlinedInput-root': {
          '& fieldset': {
            borderColor: theme => theme.palette.text.secondary,
          },
          '&:hover fieldset': {
            borderColor: theme => theme.palette.text.primary,
          },
          '&.Mui-focused fieldset': {
            borderColor: theme => theme.palette.text.primary,
          },
        },
      }}
      type="text"
      slotProps={{
        input: {
          style: {
            fontSize: 13,
            paddingLeft: 4,
            paddingBottom: 4,
            paddingTop: 4,
          },
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

const memoizedInputEntrySubject = React.memo(observer(InputEntrySubject));
export {memoizedInputEntrySubject as InputEntrySubject};
