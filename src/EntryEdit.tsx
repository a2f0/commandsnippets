import * as Constants from './constants';
import React, {useState} from 'react';
import API from './api';
import {AxiosResponse} from 'axios';
import Button from '@material-ui/core/Button';
import {ITextEntryJsonApi} from './models/TextEntryModel';
import {ITextEntryJsonApiResponseSingle} from './lib/text_entries';
import TextareaAutosize from '@material-ui/core/TextareaAutosize';
import {makeStyles} from '@material-ui/core/styles';

export const useStyles = makeStyles({
  entry: {
    verticalAlign: 'top',
    width: `calc(100% - ${100}px)`,
    display: 'inline-block',
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

export interface IEntryEdit {
  object: ITextEntryJsonApi;
  handleSaveParent: (object: ITextEntryJsonApiResponseSingle) => void;
  handleCancelEditParent: () => void;
}

const EntryEdit = ({
  object,
  handleSaveParent,
  handleCancelEditParent,
}: IEntryEdit) => {
  const [subject, setSubject] = useState<string>(object.attributes.subject);
  const [body, setBody] = useState<string>(object.attributes.body);

  const classes = useStyles();

  const handleSave = () => {
    const payload = {
      data: {
        id: object.id,
        type: 'TextEntry',
        attributes: {
          subject: subject,
          body: body,
        },
      },
    };
    API.patch('entries/' + object.id, payload, {withCredentials: true})
      .then((response: AxiosResponse<ITextEntryJsonApiResponseSingle>) => {
        handleSaveParent(response.data);
      })
      .catch(error => {
        console.error(error);
      })
      .then(() => {});
  };

  const handleCancel = () => {
    setBody(object.attributes.body);
    setSubject(object.attributes.body);
    handleCancelEditParent();
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

export default React.memo(EntryEdit);
