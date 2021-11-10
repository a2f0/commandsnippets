import * as Constants from '../../constants';
import React, {useState} from 'react';
import TextField from '@mui/material/TextField';

export interface IProps {
  handleChangeParent: (value: string) => void;
  placeholder: string;
  valueParent: string;
}

const EntrySubject = ({
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
      type="text"
      style={{
        width: `calc(100% - (${Constants.drawerWidth}px))`,
        minWidth: `calc(100% - (${Constants.drawerWidth}px))`,
        maxWidth: `calc(100% - (${Constants.drawerWidth}px))`,
      }}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
    />
  );
};
export default React.memo(EntrySubject);
