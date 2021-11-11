import * as Constants from './constants';
import React, {useState} from 'react';
import API from './api';
import {AxiosResponse} from 'axios';
import Button from '@mui/material/Button';
import {ITextEntryJsonApi} from './models/TextEntryModel';
import {ITextEntryJsonApiResponseSingle} from './lib/text_entries';
import InputEntrySubject from './styled/text_entries/InputEntrySubject';
import InputEntryTextArea from './styled/text_entries/InputEntryBody';
import makeStyles from '@mui/styles/makeStyles';

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

  const handleBodyChange = (value: string) => {
    setBody(value);
  };

  const handleSubjectChange = (value: string) => {
    setSubject(value);
  };

  return (
    <>
      <div>
        <div className={classes.dragIndicator}></div>
        <div className={classes.entry}>
          <div>
            <InputEntrySubject
              placeholder="subject"
              valueParent={subject}
              handleChangeParent={handleSubjectChange}
            />
          </div>
          <div>
            <InputEntryTextArea
              placeholder="body"
              valueParent={body}
              handleChangeParent={handleBodyChange}
            />
          </div>
          <Button
            color="secondary"
            sx={{marginRight: '2px'}}
            size="small"
            variant="outlined"
            onClick={() => {
              handleSave();
            }}
          >
            Save
          </Button>
          <Button
            color="secondary"
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
