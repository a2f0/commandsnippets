import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Paper from '@mui/material/Paper';
import React from 'react';
import SearchIcon from '@mui/icons-material/Search';
import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles(() => ({
  root: {
    padding: '0px 0px',
    display: 'flex',
    alignItems: 'center',
    width: 150,
    boxShadow: 'none',
  },
  input: {
    flex: 1,
  },
  iconButton: {
    padding: 0,
  },
  divider: {
    height: 28,
    margin: 4,
  },
}));

export default function TagSearch() {
  const classes = useStyles();

  return (
    <Paper component="form" className={classes.root}>
      {/* <IconButton className={classes.iconButton} aria-label="menu">
        <MenuIcon />
      </IconButton> */}
      <IconButton
        type="submit"
        className={classes.iconButton}
        aria-label="search"
        size="large"
      >
        <SearchIcon fontSize="small" />
      </IconButton>
      <InputBase
        className={classes.input}
        placeholder=""
        inputProps={{'aria-label': 'search tags'}}
      />
      {/* <Divider className={classes.divider} orientation="vertical" />
      <IconButton color="primary" className={classes.iconButton} aria-label="directions">
        <DirectionsIcon />
      </IconButton> */}
    </Paper>
  );
}
