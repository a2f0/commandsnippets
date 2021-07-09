import React, {useState} from 'react';
import API from './api';
import StyledButtonTags from './StyledButtonTags';
import StyledTextFieldTags from './StyledTextFieldTags';
import {useAppContext} from './AppContext';

interface ITagNewProps {
  fetchTags: () => void;
}

const TagNew = (props: ITagNewProps) => {
  const [tagName, setTagName] = useState<string>('');
  const appConfig = useAppContext();

  const handleTagNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.currentTarget.value);
  };

  const handleCancel = () => {
    setTagName('');
    appConfig.setTagNew(false);
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
      .then(() => {
        appConfig.setTagNew(false);
        props.fetchTags();
      })
      .catch(error => {
        // handle error
        console.log(error);
      })
      .then(() => {
        // always executed
      });
  };

  return (
    <>
      <StyledTextFieldTags
        value={tagName}
        id="tagNewTextField"
        onChange={e => {
          handleTagNameChange(e);
        }}
      />
      <StyledButtonTags
        id="tagNewSave"
        onClick={() => {
          handleSave();
        }}
      >
        Save
      </StyledButtonTags>
      <StyledButtonTags
        id="tagNewCancel"
        onClick={() => {
          handleCancel();
        }}
      >
        Cancel
      </StyledButtonTags>
    </>
  );
};
export default React.memo(TagNew);
