import React, {useCallback, useEffect, useState} from 'react';
import API from './api';
import {AxiosResponse} from 'axios';
import {ITagJsonApi} from './models/TagModel';
import {ITagJsonApiResponseSingle} from './lib/tags';
import {Side} from './styled/tags/StyledTagButton';
import {StyledTagButton} from './styled/tags/StyledTagButton';
import StyledTagFormContainer from './styled/tags/StyledTagFormContainer';
import StyledTextFieldTags from './styled/tags/StyledTextFieldTags';
import {useAppContext} from './AppContext';

interface IProps {
  handleNewParent: (object: ITagJsonApi) => void;
}

const TagNew = ({handleNewParent}: IProps) => {
  const [tagName, setTagName] = useState<string>('');
  const appConfig = useAppContext();

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
        handleNewParent(response.data.data);
        appConfig.setTagNew(null);
      })
      .catch(error => {
        console.error(error);
      });
  };

  return (
    <StyledTagFormContainer>
      <StyledTextFieldTags
        value={tagName}
        id="tagNewTextField"
        onChange={e => {
          handleTagNameChange(e);
        }}
      />
      <StyledTagButton
        side={Side.Left}
        id="tagNewSave"
        onClick={() => {
          handleSave();
        }}
      >
        Save
      </StyledTagButton>
      <StyledTagButton
        side={Side.Right}
        id="tagNewCancel"
        onClick={() => {
          handleCancel();
        }}
      >
        Cancel
      </StyledTagButton>
    </StyledTagFormContainer>
  );
};
export default React.memo(TagNew);
