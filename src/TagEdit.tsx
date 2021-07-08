import React, {useEffect, useState} from 'react';
import {ITag} from './TagList';
import StyledButtonTags from './StyledButtonTags';
import StyledTextFieldTags from './StyledTextFieldTags';

export interface IEntryEdit {
  object: ITag;
  handleSave: (updated_name: string) => void;
  handleCancelEdit: () => void;
}

const TagEdit = (props: IEntryEdit) => {
  const [tag, setTag] = useState<ITag>(props.object);

  useEffect(() => {
    setTag(props.object);
  }, [props.object.attributes.name]);

  const handleSave = () => {
    props.handleSave(tag.attributes.name);
  };

  const handleCancel = () => {
    setTag(props.object);
    props.handleCancelEdit();
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
          handleSave();
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
