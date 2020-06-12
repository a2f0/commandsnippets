import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import InputBase from '@material-ui/core/InputBase';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import DirectionsIcon from '@material-ui/icons/Directions';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: '0px 0px',
    display: 'flex',
    alignItems: 'center',
    width: 150,
    boxShadow: 'none'
  },
  input: {
    marginLeft: theme.spacing(1),
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
      <IconButton type="submit" className={classes.iconButton} aria-label="search">
        <SearchIcon fontSize="small"/>
      </IconButton>
      <InputBase
        className={classes.input}
        placeholder=""
        inputProps={{ 'aria-label': 'search tags' }}
      />
      {/* <Divider className={classes.divider} orientation="vertical" />
      <IconButton color="primary" className={classes.iconButton} aria-label="directions">
        <DirectionsIcon />
      </IconButton> */}
    </Paper>
  );
}
