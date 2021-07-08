import {Theme, createStyles, makeStyles} from '@material-ui/core/styles';
import React from 'react';
import TextField from '@material-ui/core/TextField';
import {useTheme} from '@material-ui/styles';

interface IStyledTextFieldProps {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const StyledTextFieldTags = ({id, value, onChange}: IStyledTextFieldProps) => {
  const theme = useTheme<Theme>();
  const useStyles = makeStyles(() =>
    createStyles({
      textField: {
        fontSize: 13,
        width: '100%',
      },
      root: {
        borderRadius: 0,
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
      value={value}
      className={`${classes.textField}`}
      id={id}
      onChange={onChange}
      variant="outlined"
      inputProps={{className: classes.noPadding}}
      InputProps={{
        className: classes.root,
      }}
    />
  );
};

export default React.memo(StyledTextFieldTags);
