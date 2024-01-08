import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AxiosResponse} from 'axios';
import {Grid} from '@mui/material';
import {ITagJsonApi} from './models/TagModel';
import {ITagJsonApiResponseSingle} from './lib/tags';
import StyledTagButton from './styled/tags/StyledTagButton';
import StyledTagFormContainer from './styled/tags/StyledTagFormContainer';
import StyledTextFieldTags from './styled/tags/StyledTextFieldTags';
import apiBase from './lib/api/apiBase';
import {observer} from 'mobx-react';

export interface ITagEdit {
  object: ITagJsonApi;
  handleSaveParent: (object: ITagJsonApiResponseSingle) => void;
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
  }, []);

  const inputSaveRef = useRef<HTMLButtonElement>(null);
  const inputCancelRef = useRef<HTMLButtonElement>(null);

  const handleSave = () => {
    const payload = {
      data: {
        id: object.id,
        type: 'Tag',
        attributes: {
          name: tagName,
        },
      },
    };
    apiBase
      .patch('tags/' + object.id, payload, {
        withCredentials: true,
      })
      .then((response: AxiosResponse<ITagJsonApiResponseSingle>) => {
        handleSaveParent(response.data);
      })
      .catch(error => {
        console.error(error);
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
        <Grid item xs={6} sx={{paddingRight: '1px'}}>
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
        <Grid item xs={6} sx={{paddingLeft: '1px'}}>
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

export default React.memo(observer(TagEdit));
