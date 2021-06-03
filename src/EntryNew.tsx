import React, {useState} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import API from './api';
import Button from '@material-ui/core/Button';
import {ITag} from './Entry';
export interface IEntryNewProps {
  tag: ITag;
  retrieveEntries: () => void;
  handleCancelNewEntry: () => void;
}

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
    minWidth: '300px',
  },
  entryBody: {
    display: 'inline-block',
    fontSize: 14,
    margin: 'auto',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    padding: 2,
    border: '1px solid red',
    minWidth: '300px',
  },
  dragIndicator: {
    display: 'inline-block',
    width: '15px',
  },
});

const EntryNew = (props: IEntryNewProps) => {
  const [subject, setSubject] = useState<string | null>();
  const [body, setBody] = useState<string | null>();
  const classes = useStyles();

  const handleSave = () => {
    console.log('handle save');
    //setBody()
    //setSubject()
    //props.handleSave(subject, body)
    const text_entry_payload = {
      data: {
        type: 'TextEntry',
        attributes: {
          subject: subject,
          body: body,
        },
      },
    };

    API.post('/entries', text_entry_payload, {withCredentials: true})
      .then(response => {
        // handle success
        console.log(response);
        console.log(props.tag);
        const text_entry_through_model_payload = {
          data: {
            type: 'TagTextEntryThroughModel',
            attributes: {},
            relationships: {
              tag: {
                data: {
                  type: 'Tag',
                  id: props.tag.id,
                },
              },
              text_entry: {
                data: {
                  type: 'TextEntry',
                  id: response.data.data.id,
                },
              },
            },
          },
        };
        API.post('/tags_entries', text_entry_through_model_payload, {
          withCredentials: true,
        })
          .then(() => {
            props.retrieveEntries();
            props.handleCancelNewEntry();
          })
          .catch(error => {
            // handle error
            console.log(error);
          })
          .then(() => {
            // always executed
          });
      })
      .catch(error => {
        // handle error
        console.log(error);
      })
      .then(() => {
        // always executed
      });
  };

  const handleCancel = () => {
    setBody(body);
    setSubject(subject);
    props.handleCancelNewEntry();
  };

  const handleBodyChange = (body: string | null) => {
    setBody(body);
  };

  const handleSubjectChange = (subject: string | null) => {
    setSubject(subject);
  };

  return (
    <>
      <div>
        <div className={classes.dragIndicator}></div>
        <div className={classes.entry}>
          <div>
            <div
              className={classes.entrySubject}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onBlur={e => {
                handleSubjectChange(e.currentTarget.textContent);
              }}
            >
              {subject}
            </div>
          </div>
          <div>
            <div
              className={classes.entryBody}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onBlur={e => {
                handleBodyChange(e.currentTarget.textContent);
              }}
            >
              {body}
            </div>
          </div>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              handleSave();
            }}
          >
            Save
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              handleCancel();
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
};
export default React.memo(EntryNew);
