import * as Constants from '../../constants';
import React, {useState} from 'react';
import TextareaAutosize from '@mui/material/TextareaAutosize';
import {Theme} from '@mui/material/styles';
import {useTheme} from '@mui/styles';

export interface IProps {
  handleChangeParent: (value: string) => void;
  placeholder: string;
  valueParent: string;
}

const InputEntryBody = ({
  handleChangeParent,
  valueParent,
  placeholder,
}: IProps) => {
  const [value, setValue] = useState<string>(valueParent);

  const theme = useTheme<Theme>();

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    handleChangeParent(event.target.value);
  };

  return (
    <TextareaAutosize
      style={{
        width: `calc(100% - (${Constants.drawerWidth}px))`,
        minWidth: `calc(100% - (${Constants.drawerWidth}px))`,
        maxWidth: `calc(100% - (${Constants.drawerWidth}px))`,
        background: theme.textInput.background,
        paddingLeft: 4,
        color: theme.palette.text.primary,
      }}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
    />
  );
};
export default React.memo(InputEntryBody);
