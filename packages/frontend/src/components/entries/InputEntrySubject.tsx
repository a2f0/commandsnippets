import {TextField} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {useTheme} from '@mui/material/styles';
import React, {useState} from 'react';
import {outlinedFieldSx} from '../../theme/sx';

interface IProps {
  handleChangeParent: (value: string) => void;
  placeholder: string;
  valueParent: string;
  id: string;
  readOnly?: boolean;
}

const InputEntrySubject = ({
  handleChangeParent,
  valueParent,
  placeholder,
  id,
  readOnly = false,
}: IProps) => {
  const [value, setValue] = useState<string>(valueParent);
  const theme: Theme = useTheme();

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    handleChangeParent(event.target.value);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <TextField
      id={id}
      autoComplete="off"
      sx={{
        width: `calc(100% - (${theme.drawer.width}px))`,
        minWidth: `calc(100% - (${theme.drawer.width}px))`,
        maxWidth: `calc(100% - (${theme.drawer.width}px))`,
        marginLeft: 0,
        marginBottom: '4px',
        ...outlinedFieldSx,
      }}
      type="text"
      slotProps={{
        htmlInput: {
          readOnly,
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
    />
  );
};

const memoizedInputEntrySubject = React.memo(InputEntrySubject);

export {memoizedInputEntrySubject as InputEntrySubject};
