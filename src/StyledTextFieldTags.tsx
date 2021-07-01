import {Theme, createStyles, makeStyles} from '@material-ui/core/styles';
import React from 'react';
import TextField from '@material-ui/core/TextField';
import {useTheme} from '@material-ui/styles';

interface IStyledTextFieldProps {
  id: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const StyledTextFieldTags = ({id, onChange}: IStyledTextFieldProps) => {
  const theme = useTheme<Theme>();
  const useStyles = makeStyles(() =>
    createStyles({
      textField: {
        borderRadius: 0,
        fontSize: 13,
        width: '100%%',
      },
      root: {
        height: 30,
        fontSize: 14,
        '&.Mui-focused': {
          border: `2px solid ${theme.palette.secondary.main}`,
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
        },
      },
      noPadding: {
        padding: 0,
      },
    })
  );
  const classes = useStyles();
  return (
    <TextField
      className={`${classes.textField} without-padding`}
      id={id}
      onChange={onChange}
      variant="outlined"
      inputProps={{style: {padding: 0}}}
      InputProps={{
        className: classes.root,
      }}
    />
  );
};

export default StyledTextFieldTags;
