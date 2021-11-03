import React, {useCallback, useEffect, useState} from 'react';
import API from './api';
import {AxiosResponse} from 'axios';
import {ITagJsonApi} from './models/TagModel';
import {ITagJsonApiResponseSingle} from './lib/tags';
import {Side} from './styled/tags/StyledTagButton';
import {StyledTagButton} from './styled/tags/StyledTagButton';
import StyledTagFormContainer from './styled/tags/StyledTagFormContainer';
import StyledTextFieldTags from './styled/tags/StyledTextFieldTags';
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
        handleSaveParent(response.data);
      })
      .catch(error => {
        console.error(error);
      })
      .then(() => {});
  };

  const handleCancel = () => {
    handleCancelEditParent();
  };

  const handleTagNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.target.value);
  };

  return (
    <StyledTagFormContainer>
      <StyledTextFieldTags
        value={tagName}
        id={`tagEdit-${object.id}`}
        onChange={e => {
          handleTagNameChange(e);
        }}
      />
      <StyledTagButton
        side={Side.Left}
        id={`tagEditSave-${object.id}`}
        onClick={() => {
          handleSave();
        }}
      >
        Save
      </StyledTagButton>
      <StyledTagButton
        side={Side.Right}
        id={`tagEditCancel-${object.id}`}
        onClick={() => {
          handleCancel();
        }}
      >
        Cancel
      </StyledTagButton>
    </StyledTagFormContainer>
  );
};

export default React.memo(observer(TagEdit));
