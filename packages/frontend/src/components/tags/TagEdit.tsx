import Grid from '@mui/material/Grid';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {ITagJsonApiResponseSingle} from '../../lib/api/responses/types';
import {tearleadsApi} from '../../lib/api/tearleadsApi';
import type {ITagJsonApi} from '../../lib/store/models/TagModel';
import {StyledTagButton} from './StyledTagButton';
import {StyledTagFormContainer} from './StyledTagFormContainer';
import {StyledTextFieldTags} from './StyledTextFieldTags';

export interface ITagEdit {
  object: ITagJsonApi;
  handleSaveParent: (object: ITagJsonApi) => void;
  handleCancelEditParent: () => void;
}

const TagEdit = ({
  handleSaveParent,
  handleCancelEditParent,
  object,
}: ITagEdit) => {
  const [tagName, setTagName] = useState<string>(object.attributes.name);
  const escFunction = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      handleCancel();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', escFunction, false);

    return () => {
      document.removeEventListener('keydown', escFunction, false);
    };
  }, [escFunction]);

  const inputSaveRef = useRef<HTMLButtonElement>(null);
  const inputCancelRef = useRef<HTMLButtonElement>(null);

  const handleSave = () => {
    tearleadsApi
      .updateTag(object.id, tagName)
      .then((response: ITagJsonApiResponseSingle) => {
        handleSaveParent(response.data);
      })
      .catch(error => {
        console.error('Unexpected error updating tag:', error);
      });
  };

  const handleCancel = () => {
    handleCancelEditParent();
  };

  const handleTagNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.target.value);
  };

  return (
    <StyledTagFormContainer id={`tagEdit${object.id}`}>
      <StyledTextFieldTags
        id={`tagEditTagName${object.id}`}
        value={tagName}
        onChange={e => {
          handleTagNameChange(e);
        }}
      />
      <Grid container spacing={0}>
        <Grid sx={{paddingRight: '1px'}} size={{xs: 6}}>
          <StyledTagButton
            ref={inputSaveRef}
            id={`tagEditSave${object.id}`}
            onClick={() => {
              handleSave();
            }}
          >
            Save
          </StyledTagButton>
        </Grid>
        <Grid sx={{paddingLeft: '1px'}} size={{xs: 6}}>
          <StyledTagButton
            ref={inputCancelRef}
            id={`tagEditCancel${object.id}`}
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

const memoizedTagEdit = React.memo(observer(TagEdit));

export {memoizedTagEdit as TagEdit};
