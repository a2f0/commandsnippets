import React, {useState} from 'react';
import Button from '@material-ui/core/Button';
import {makeStyles} from '@material-ui/core/styles';
import API from './api.ts';
import {useAppContext} from './AppContext.tsx';

const useStyles = makeStyles({
  tagName: {
    display: 'inline-block',
    fontSize: 14,
    margin: 'auto',
    border: '1px solid red',
    paddingLeft: 2,
    minWidth: '100px',
  },
});

const TagNew = React.memo(function TagNew(props) {
  const [tagName, setTagName] = useState();
  const classes = useStyles();
  const appConfig = useAppContext();

  const handleTagNameChange = newTagName => {
    setTagName(newTagName);
  };

  const handleCancel = () => {
    setTagName(null);
    appConfig.setTagNew(true);
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
      .then(function () {
        appConfig.setTagNew(true);
        props.fetchTags();
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      })
      .then(function () {
        // always executed
      });
  };

  return (
    <>
      <div>
        <div
          className={classes.tagName}
          contentEditable={true}
          suppressContentEditableWarning={true}
          onBlur={e => {
            handleTagNameChange(e.currentTarget.textContent);
          }}
        >
          {tagName}
        </div>
      </div>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          handleSave();
        }}
      >
        Save
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          handleCancel();
        }}
      >
        Cancel
      </Button>
    </>
  );
});
export default TagNew;
