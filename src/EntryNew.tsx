import React, {useState} from 'react';
import API from './api';
import {AxiosResponse} from 'axios';
import Button from '@mui/material/Button';
import {ITagTextEntryThroughModelJsonApiResponseSingle} from './lib/tag_text_entry_through_models';
import {ITextEntryJsonApiResponseSingle} from './lib/text_entries';
import InputEntryTextArea from './styled/text_entries/InputEntryBody';
import {useAppContext} from './AppContext';
import {useParams} from 'react-router-dom';
import {useStyles} from './EntryEdit';

export interface IEntryNewProps {
  filterAndSortParent: () => void;
}

interface IParamTypes {
  user: string;
  tag: string;
}

const EntryNew = ({filterAndSortParent}: IEntryNewProps) => {
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const classes = useStyles();
  const appConfig = useAppContext();
  const {user} = useParams<IParamTypes>();
  const {tag} = useParams<IParamTypes>();

  const handleSave = () => {
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
      .then((response: AxiosResponse<ITextEntryJsonApiResponseSingle>) => {
        appConfig.updateOrCreateTextEntry(response.data.data);
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
          .then(
            (
              response: AxiosResponse<ITagTextEntryThroughModelJsonApiResponseSingle>
            ) => {
              console.info(response.data.data);
              appConfig.updateOrCreateTagTextEntryThroughModel(
                response.data.data
              );
              filterAndSortParent();
              appConfig.setEntryNew(null);
            }
          )
          .catch(error => {
            console.error(error);
          })
          .then(() => {});
      })
      .catch(error => {
        console.error(error);
      })
      .then(() => {});
  };

  const handleCancel = () => {
    setBody(body);
    setSubject(subject);
    appConfig.setEntryNew(null);
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
  };

  const handleSubjectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSubject(event.target.value);
  };

  return (
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
  );
};
export default React.memo(EntryNew);
