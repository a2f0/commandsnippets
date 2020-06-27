import React from 'react'
import { useTheme } from '@material-ui/styles';
import Button from '@material-ui/core/Button';

import TextField from '@material-ui/core/TextField';

const EntryEdit = React.memo(function (props) {

  const theme = useTheme();
  
  return (
    <>
      <div className={props.classes.entryWrapper}>
        <div style={{...theme.custom.dragIndicator}}></div>
        <div className={props.classes.entry}>
          <form noValidate autoComplete="off">
            <TextField
              value={props.subject}
              id="outlined-textarea"
              placeholder="Subject"
              variant="outlined"
              fullWidth
            />
            <TextField
              value={props.body}
              id="outlined-textarea"
              placeholder="Body"
              multiline
              variant="outlined"
              fullWidth
            />
            <Button variant="outlined">
              Save
            </Button>
            <Button variant="outlined" onClick={() => { props.handleCancelEdit();}}>
              Cancel
            </Button>
          </form>
        </div>
      </div>
    </>
  )
})
export default EntryEdit