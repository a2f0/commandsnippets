import * as Constants from '../../constants';
import React, {useState} from 'react';
import TextareaAutosize from '@mui/material/TextareaAutosize';

export interface IProps {
  handleChangeParent: (value: string) => void;
  placeholder: string;
  valueParent: string;
}

const EntryTextArea = ({
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
    <TextareaAutosize
      style={{
        width: `calc(100% - (${Constants.drawerWidth}px))`,
        maxWidth: `calc(100% - (${Constants.drawerWidth}px))`,
      }}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
    />
  );
};
export default React.memo(EntryTextArea);
