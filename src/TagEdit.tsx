import React, {useCallback, useEffect, useState} from 'react';
import API from './api';
import {AxiosResponse} from 'axios';
import {ITagJsonApi} from './models/TagModel';
import {ITagJsonApiResponseSingle} from './lib/tags';
import StyledButtonTags from './StyledButtonTags';
import StyledTextFieldTags from './StyledTextFieldTags';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';

export interface ITagEdit {
  object: ITagJsonApi;
  handleSaveParent: () => void;
  handleCancelEdit: () => void;
}

const TagEdit = ({handleSaveParent, handleCancelEdit, object}: ITagEdit) => {
  const appConfig = useAppContext();
  const [tagName, setTagName] = useState<string>(object.attributes.name);
  const escFunction = useCallback(event => {
    if (event.keyCode === 27) {
      handleCancel();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', escFunction, false);

    return () => {
      document.removeEventListener('keydown', escFunction, false);
    };
  }, []);

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
    API.patch('tags/' + object.id, payload, {
      withCredentials: true,
    })
      .then((response: AxiosResponse<ITagJsonApiResponseSingle>) => {
        const existing = appConfig.tagsArray.find(
          o => o.id === response.data.data.id
        );
        existing?.update(response.data.data);
        handleSaveParent();
      })
      .catch(error => {
        console.error(error);
      })
      .then(() => {});
  };

  const handleCancel = () => {
    handleCancelEdit();
  };

  const handleTagNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.target.value);
  };

  return (
    <>
      <StyledTextFieldTags
        value={tagName}
        id={`tagEdit-${object.id}`}
        onChange={e => {
          handleTagNameChange(e);
        }}
      />
      <StyledButtonTags
        id={`tagEditSave-${object.id}`}
        onClick={() => {
          handleSave();
        }}
      >
        Save
      </StyledButtonTags>
      <StyledButtonTags
        id={`tagEditCancel-${object.id}`}
        onClick={() => {
          handleCancel();
        }}
      >
        Cancel
      </StyledButtonTags>
    </>
  );
};

export default React.memo(observer(TagEdit));
