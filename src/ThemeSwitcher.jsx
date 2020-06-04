import React, { useState, useEffect } from "react";
import Button from '@material-ui/core/Button';
import { useTheme } from '@material-ui/styles';
import {lightTheme } from './themes.js'

const ThemeSwitcher = React.memo(function ThemeSwitcher(props) {

  const theme = useTheme()

  return (
    <>
      {theme == lightTheme
        ? <Button size="small" onClick={props.handleThemeSwitcher}>Dark</Button>
        : <Button size="small" onClick={props.handleThemeSwitcher}>Light</Button>
      }
    </>
  )
})
export default ThemeSwitcher