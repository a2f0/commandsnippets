import * as Constants from './constants';
import React, {useState} from 'react';
import API from './api';
import Button from '@material-ui/core/Button';
import TextareaAutosize from '@material-ui/core/TextareaAutosize';
import {makeStyles} from '@material-ui/core/styles';
import {useAppContext} from './AppContext';
import {useParams} from 'react-router-dom';
export interface IEntryNewProps {
  retrieveEntries: () => void;
  handleCancelNewEntry: () => void;
}

const useStyles = makeStyles({
  entry: {
    verticalAlign: 'top',
    width: `calc(100% - ${100}px)`,
    display: 'inline-block',
    marginBottom: 16,
    '&:hover': {
      color: 'white',
    },
    '&:active': {
      color: 'white',
    },
  },
  entrySubject: {
    fontSize: 14,
    margin: 'auto',
    padding: 2,
    border: '1px solid red',
    width: '100%',
  },

  entryBody: {
    display: 'inline-block',
    fontSize: 14,
    margin: 'auto',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    padding: 2,
    border: '1px solid red',
    minWidth: '300px',
  },
  textArea: {
    width: '100%',
  },
  dragIndicator: {
    display: 'inline-block',
    width: `${Constants.dragIndicatorWidthTag}px`,
  },
});

interface IParamTypes {
  user: string;
  tag: string;
}

const EntryNew = (props: IEntryNewProps) => {
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const classes = useStyles();
  const appConfig = useAppContext();
  const {user} = useParams<IParamTypes>();
  const {tag} = useParams<IParamTypes>();

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

    const userObject = appConfig.usersArray.find(
      element => element.attributes.username === user
    );

    const tagObject = appConfig.tagsArray.find(
      element =>
        element.attributes.name === tag &&
        element.relationships.user.data.id === userObject?.id
    );

    API.post('/entries', text_entry_payload, {withCredentials: true})
      .then(response => {
        // handle success
        const text_entry_through_model_payload = {
          data: {
            type: 'TagTextEntryThroughModel',
            attributes: {},
            relationships: {
              tag: {
                data: {
                  type: 'Tag',
                  id: tagObject?.id,
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

  const handleBodyChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(event.target.value);
  };

  const handleSubjectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSubject(event.target.value);
  };

  return (
    <>
      <div>
        <div className={classes.dragIndicator}></div>
        <div className={classes.entry}>
          <div>
            <input
              type="text"
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
