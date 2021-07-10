import React, {useCallback, useEffect, useState} from 'react';
import {ITag} from './TagList';
import StyledButtonTags from './StyledButtonTags';
import StyledTextFieldTags from './StyledTextFieldTags';

export interface IEntryEdit {
  object: ITag;
  handleSave: (updated_name: string) => void;
  handleCancelEdit: () => void;
}

const TagEdit = ({object, handleSave, handleCancelEdit}: IEntryEdit) => {
  const [tag, setTag] = useState<ITag>(object);

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

  useEffect(() => {
    setTag(object);
  }, [object.attributes.name]);

  const handleCancel = () => {
    setTag(object);
    handleCancelEdit();
  };

  const handleTagNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTag = {...tag};
    newTag.attributes.name = event.target.value;
    setTag(newTag);
  };

  return (
    <>
      <StyledTextFieldTags
        value={tag.attributes.name}
        id={`tagEdit-${tag.id}`}
        onChange={e => {
          handleTagNameChange(e);
        }}
      />
      <StyledButtonTags
        id={`tagEditSave-${tag.id}`}
        onClick={() => {
          handleSave(tag.attributes.name);
        }}
      >
        Save
      </StyledButtonTags>
      <StyledButtonTags
        id={`tagEditCancel-${tag.id}`}
        onClick={() => {
          handleCancel();
        }}
      >
        Cancel
      </StyledButtonTags>
    </>
  );
};

export default React.memo(TagEdit);
