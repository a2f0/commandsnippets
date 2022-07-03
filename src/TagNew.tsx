import React, {useCallback, useEffect, useRef, useState} from 'react';
import {activeTagEditField, appMode} from './lib/shared';
import API from './api';
import {AxiosResponse} from 'axios';
import Grid from '@mui/material/Grid';
import {ITagJsonApiResponseSingle} from './lib/tags';
import StyledTagButton from './styled/tags/StyledTagButton';
import StyledTagFormContainer from './styled/tags/StyledTagFormContainer';
import StyledTextFieldTags from './styled/tags/StyledTextFieldTags';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';

interface IProps {
  handleNewParent: () => void;
  id: string;
}

const TagNew = ({handleNewParent, id}: IProps) => {
  const [tagName, setTagName] = useState<string>('');
  const appConfig = useAppContext();
  const inputSaveRef = useRef<HTMLButtonElement>(null);
  const inputCancelRef = useRef<HTMLButtonElement>(null);
  const inputTagNameRef = React.useRef<HTMLInputElement>();

  const setInputTagNameRef = (element: HTMLInputElement) => {
    inputTagNameRef.current = element;
  };

  const escFunction = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      handleCancel();
    }
  }, []);

  useEffect(() => {
    if (appConfig.activeTagEditField === activeTagEditField.save) {
      inputSaveRef.current?.focus();
    } else if (appConfig.activeTagEditField === activeTagEditField.cancel) {
      inputCancelRef.current?.focus();
    }
  }, [appConfig.activeTagEditField]);

  useEffect(() => {
    if (appConfig.activeTagEditField === activeTagEditField.name) {
      inputTagNameRef.current?.focus();
    }
    return () => {
      appConfig.setActiveTagEditField(activeTagEditField.name);
    };
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', escFunction, false);

    return () => {
      document.removeEventListener('keydown', escFunction, false);
    };
  }, []);

  const handleTagNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.currentTarget.value);
  };

  const handleCancel = () => {
    setTagName('');
    appConfig.setTagNew(null);
  };

  const handleSave = () => {
    const payload = {
      data: {
        type: 'Tag',
        attributes: {
          name: tagName,
        },
      },
    };
    API.post('/tags', payload, {withCredentials: true})
      .then((response: AxiosResponse<ITagJsonApiResponseSingle>) => {
        appConfig.reconcileCollection(response.data.included);
        appConfig.updateOrCreateTag(response.data.data);
        handleNewParent();
        appConfig.setTagNew(null);
      })
      .catch(error => {
        console.error(error);
      });
  };

  const keyListener = useCallback((event: KeyboardEvent) => {
    const trappedKeyCodes = ['Tab'];
    if (
      trappedKeyCodes.includes(event.code) &&
      appConfig.appMode === appMode.tagEditor
    ) {
      if (appConfig.activeTagEditField === activeTagEditField.name) {
        appConfig.setActiveTagEditField(activeTagEditField.save);
      } else if (appConfig.activeTagEditField === activeTagEditField.save) {
        appConfig.setActiveTagEditField(activeTagEditField.cancel);
      } else if (appConfig.activeTagEditField === activeTagEditField.cancel) {
        appConfig.setActiveTagEditField(activeTagEditField.name);
        inputTagNameRef.current?.focus();
      }
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', keyListener, false);
    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, []);

  return (
    <StyledTagFormContainer id={id}>
      <StyledTextFieldTags
        ref={setInputTagNameRef}
        value={tagName}
        id={`${id}TextField`}
        onChange={e => {
          handleTagNameChange(e);
        }}
      />
      <Grid container spacing={0}>
        <Grid item xs={6} sx={{paddingRight: '1px'}}>
          <StyledTagButton
            ref={inputSaveRef}
            id={`${id}Save`}
            onClick={() => {
              handleSave();
            }}
          >
            Save
          </StyledTagButton>
        </Grid>
        <Grid item xs={6} sx={{paddingLeft: '1px'}}>
          <StyledTagButton
            ref={inputCancelRef}
            id={`${id}Cancel`}
            onClick={() => {
              handleCancel();
            }}
          >
            Cancel
          </StyledTagButton>
        </Grid>
      </Grid>
    </StyledTagFormContainer>
  );
};
export default React.memo(observer(TagNew));
