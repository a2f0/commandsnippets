import React, { useState, useEffect } from 'react'
import { useTheme } from '@material-ui/styles';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles({

  entry: {
    display: 'inline-block',
    verticalAlign: 'top',
  },
  entryWrapper: {
    marginBottom: 16,
    // "&:hover": {
    //   color: "white"
    // },
    // "&:active": {
    //   color: "white"
    // },
  },
  entrySubject: {
    display: 'inline-block',
    fontSize: 14,
    margin: 'auto',
    padding: 2,
    border: '1px solid red',
    minWidth: '300px'
  },
  
  entryBody: {
    display: 'inline-block',
    fontSize: 14,
    margin: 'auto',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    padding: 2,
    border: '1px solid red',
    minWidth: '300px'
  }
});

const EntryEdit = React.memo(function (props) {

  const theme = useTheme();

  useEffect(() => {
    setBody(props.body)
    setSubject(props.subject)
  }, [props.body, props.subject]);

  const [subject,setSubject] = useState()
  const [body,setBody] = useState()

  const classes = useStyles();

  const handleSave = () => {
    props.handleSave(subject, body)
  }

  const handleCancel = () => {
    setBody(props.body)
    setSubject(props.subject)
    props.handleCancelEdit()
  }

  const handleBodyChange = (body) => {
    setBody(body);
  }

  const handleSubjectChange = (subject) => {
    setSubject(subject);
  }
  
  return (
    <>
      <div className={props.classes.entryWrapper}>
        <div style={{...theme.custom.dragIndicator}}></div>
        <div className={classes.entry}>
          <div>
            <div className={classes.entrySubject} 
              contentEditable={true}
              suppressContentEditableWarning={true}
              onBlur={(e) => { handleSubjectChange(e.currentTarget.textContent);}}> 
              {subject}
            </div>
          </div>
          <div>
            <div
              className={classes.entryBody}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onBlur={(e) => { handleBodyChange(e.currentTarget.textContent);}}> 
              {body}
            </div>
          </div>
          <Button size="small" variant="outlined" onClick={() => { handleSave();}}>
            Save
          </Button>
          <Button size="small" variant="outlined" onClick={() => { handleCancel();}}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  )
})
export default EntryEdit