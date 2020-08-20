import React, { useState, useEffect } from 'react'
import { useTheme } from '@material-ui/styles';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import TextareaAutosize from '@material-ui/core/TextareaAutosize';

const useStyles = makeStyles({
  entry: {
    verticalAlign: 'top',
    width: `calc(100% - ${100}px)`,
    display: 'inline-block'
  },
  entrySubject: {
    fontSize: 14,
    margin: 'auto',
    padding: 2,
    border: '1px solid red',
    width: '100%'
  },
  
  entryBody: {
    display: 'inline-block',
    fontSize: 14,
    margin: 'auto',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap', /* css-3 */
    whiteSpace: '-moz-pre-wrap', 
    whiteSpace: '-pre-wrap',
    whiteSpace: '-o-pre-wrap',
    wordWrap: 'break-word',
    padding: 2,
    border: '1px solid red',
    minWidth: '300px'
  },
  textArea: {
    width: '100%'
  }
});

const EntryEdit = React.memo(function (props) {

  const theme = useTheme();

  useEffect(() => {
    setBody(props.body)
    setSubject(props.subject)
  }, [props.body, props.subject]);

  const [subject,setSubject] = useState('')
  const [body,setBody] = useState('')

  const classes = useStyles();

  const handleSave = () => {
    props.handleSave(subject, body)
  }

  const handleCancel = () => {
    setBody(props.body)
    setSubject(props.subject)
    props.handleCancelEdit()
  }

  const handleBodyChange = (event) => {
    setBody(event.target.value);
  }

  const handleSubjectChange = (event) => {
    setSubject(event.target.value);
  }
  
  return (
    <>
      <div className={props.classes.entryWrapper}>
        <div style={{...theme.custom.dragIndicator}}></div>
        <div className={classes.entry}>
          <div>
            <input type="text"
              className={classes.entrySubject}
              value={subject}
              onChange={handleSubjectChange}
            />
          </div>
          <div>
            <TextareaAutosize
              className={classes.textArea}
             

              placeholder="body"
              value={body}
              onChange={handleBodyChange}
            />
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