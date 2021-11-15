import * as Constants from '../../constants';
import React, {useState} from 'react';
import TextField from '@mui/material/TextField';
import {Theme} from '@mui/material/styles';
import {useTheme} from '@mui/styles';

export interface IProps {
  handleChangeParent: (value: string) => void;
  placeholder: string;
  valueParent: string;
}

const InputEntrySubject = ({
  handleChangeParent,
  valueParent,
  placeholder,
}: IProps) => {
  const [value, setValue] = useState<string>(valueParent);
  const theme: Theme = useTheme();

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    handleChangeParent(event.target.value);
  };

  return (
    <TextField
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
    />
  );
};
export default React.memo(InputEntrySubject);
