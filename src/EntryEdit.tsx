import * as Constants from './constants';
import React, {useEffect, useRef, useState} from 'react';
import API from './api';
import {AxiosResponse} from 'axios';
import Button from '@mui/material/Button';
import {ITextEntryJsonApi} from './models/TextEntryModel';
import {ITextEntryJsonApiResponseSingle} from './lib/text_entries';
import InputEntryBody from './styled/text_entries/InputEntryBody';
import InputEntrySubject from './styled/text_entries/InputEntrySubject';
import makeStyles from '@mui/styles/makeStyles';
import {needsScrollingIntoView} from './lib/text_entries';

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
  dragIndicator: {
    display: 'inline-block',
    width: `${Constants.dragIndicatorWidthTag}px`,
  },
});

export interface IEntryEdit {
  object: ITextEntryJsonApi;
  handleSaveParent: (object: ITextEntryJsonApiResponseSingle) => void;
  handleCancelEditParent: () => void;
  id: string;
}

const EntryEdit = ({
  object,
  handleSaveParent,
  handleCancelEditParent,
  id,
}: IEntryEdit) => {
  const saveRef = useRef<HTMLButtonElement>();
  const [subject, setSubject] = useState<string>(object.attributes.subject);
  const [body, setBody] = useState<string>(object.attributes.body);

  const classes = useStyles();

  useEffect(() => {
    if (saveRef.current !== undefined) {
      if (needsScrollingIntoView(saveRef.current)) {
        saveRef.current?.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
      }
    }
  }, [saveRef.current]);

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

  const setSaveRef = (element: HTMLButtonElement) => {
    saveRef.current = element;
  };

  return (
    <>
      <div>
        <div className={classes.dragIndicator}></div>
        <div className={classes.entry}>
          <div>
            <InputEntrySubject
              id={`${id}Subject`}
              placeholder="subject"
              valueParent={subject}
              handleChangeParent={handleSubjectChange}
            />
          </div>
          <div>
            <InputEntryBody
              id={`${id}Body`}
              placeholder="body"
              valueParent={body}
              handleChangeParent={handleBodyChange}
            />
          </div>
          <Button
            id={`${id}Save`}
            color="secondary"
            sx={{
              marginRight: '2px',
              scrollMarginBottom: '10px',
              marginBottom: '10px',
            }}
            size="small"
            variant="outlined"
            onClick={() => {
              handleSave();
            }}
          >
            Save
          </Button>
          <Button
            id={`${id}Cancel`}
            ref={setSaveRef}
            color="secondary"
            size="small"
            variant="outlined"
            onClick={() => {
              handleCancel();
            }}
            sx={{
              scrollMarginBottom: '10px',
              marginBottom: '10px',
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
