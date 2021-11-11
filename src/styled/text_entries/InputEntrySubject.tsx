import * as Constants from '../../constants';
import React, {useState} from 'react';
import TextField from '@mui/material/TextField';

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

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    handleChangeParent(event.target.value);
  };

  return (
    <TextField
      sx={{
        background: 'black',
        width: `calc(100% - (${Constants.drawerWidth}px))`,
        minWidth: `calc(100% - (${Constants.drawerWidth}px))`,
        maxWidth: `calc(100% - (${Constants.drawerWidth}px))`,
        marginLeft: 0,
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
