import React, {useCallback, useEffect, useState} from 'react';
import API from './api';
import {Instance} from 'mobx-state-tree';
import StyledButtonTags from './StyledButtonTags';
import StyledTextFieldTags from './StyledTextFieldTags';
import {TagJsonAPI} from './AppStateStore';
import {observer} from 'mobx-react';

export interface ITagEdit {
  object: Instance<typeof TagJsonAPI>;
  handleSaveParent: () => void;
  handleCancelEdit: () => void;
}

const TagEdit = ({handleSaveParent, handleCancelEdit, object}: ITagEdit) => {
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
      .then(response => {
        object.update(response.data.data);
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
