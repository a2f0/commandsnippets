import React, { useState, useEffect } from 'react'
import { useTheme } from '@material-ui/styles';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import API from './api.js'

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
    border: '1px solid red',
    padding: 2,
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

const EntryNew = React.memo(function (props) {

  const theme = useTheme();

  useEffect(() => {
    setBody(props.body)
    setSubject(props.subject)
  }, [props.body, props.subject]);

  const [subject,setSubject] = useState()
  const [body,setBody] = useState()
  const classes = useStyles();

  const handleSave = () => {
    console.log('handle save')
    //setBody()
    //setSubject()
    //props.handleSave(subject, body)
    const text_entry_payload = {
      'data': {
        'type': 'TextEntry',
        'attributes': {
          'subject': subject,
          'body': body,
        }
      }
    }

    API.post('/entries', text_entry_payload, {withCredentials: true})
      .then(function (response) {
        // handle success
        console.log(response);
        console.log(props.tag)
        const text_entry_through_model_payload = {
          'data': {
            'type': 'TagTextEntryThroughModel',
            'attributes': {},
            'relationships': {
              'tag': {
                'data': {
                  'type': 'Tag', 
                  'id': props.tag.id 
                }
              },
              'text_entry': {
                'data': {
                  'type': 'TextEntry',
                  'id': response.data.data.id
                }
              }
            }
          }
        }
        API.post('/tags_entries', text_entry_through_model_payload, {withCredentials: true})
          .then(function (response) {
            console.log(response)
          })
          .catch(function (error) {
            // handle error
            console.log(error);
          })
          .then(function () {
            // always executed
          });
      

      })
      .catch(function (error) {
        // handle error
        console.log(error);
      })
      .then(function () {
        // always executed
      });

    



    console.log('actially made it here')
    // let new_text_entry = {...textEntry}
    // new_text_entry.attributes.subject = updated_subject
    // new_text_entry.attributes.body = updated_body
    // setTextEntry(new_text_entry)
    // setIsEditing(false)
  };

  const handleCancel = () => {
    setBody(props.body)
    setSubject(props.subject)
    props.handleCancelNewEntry()
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
export default EntryNew