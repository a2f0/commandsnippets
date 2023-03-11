import {ITagJsonApi, TagHelpers} from './models/TagModel';
import React, {useEffect, useRef, useState} from 'react';
import {useLocation, useParams} from 'react-router-dom';
import {Instance} from 'mobx-state-tree';
import TagList from './TagList';
import {TagModel} from './models/TagModel';
import {autorun} from 'mobx';

import {observer} from 'mobx-react';
import {styled} from '@mui/material/styles';
import {useAppContext} from './AppContext';
import {useNavigate} from 'react-router-dom';

export interface IUser {
  id: number;
  type: string;
  attributes: {
    username: string;
  };
}

export const LeftToRight = styled('div')(() => ({
  direction: 'ltr',
}));

const TagListWrapper = () => {
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const {user} = useParams();
  const {tag} = useParams();

  const [userName, _setUsername] = useState<string | undefined>(undefined);
  // Used to access the react state from within the listener.
  const userRef = useRef(user);
  const setUsername = (data: string | undefined) => {
    userRef.current = data;
    _setUsername(data);
  };
  useEffect(() => {
    setUsername(user);
  }, [location]);

  const [tags, _setTags] = useState<Array<ITagJsonApi>>([]);
  // Used to access the react state from within the listener.
  const tagsRef = useRef(tags);
  const setTags = (data: Array<ITagJsonApi>) => {
    tagsRef.current = data;
    _setTags(data);
  };

  useEffect(() => {
    if (userName !== undefined) {
      appConfig.setCurrentUser(userName);
      appConfig.fetchTags(userName).then(() => {
        const array = TagHelpers.filterAndSort(appConfig);
        if (array.length > 1) {
          let selected: Instance<typeof TagModel> | undefined = undefined;
          if (tag) {
            selected = appConfig.tagsArray.find(c => c.attributes.name === tag);
          } else {
            selected = appConfig.tagsArray.find(c => c.id === array[0].id);
          }
          if (selected !== undefined) {
            appConfig.setTagSelectedID(selected.id);
            navigate(`/${userName}/${selected.attributes.name}`);
          }
        }
        setTags(array);
      });
    }
  }, [appConfig.tagSortOrder, userName]);

  useEffect(
    () =>
      autorun(() => {
        setTags(TagHelpers.filterAndSort(appConfig));
        const current = tags.find(
          element => element.id === appConfig.tagSelectedID
        );
        if (current === undefined) {
          if (tags.length > 0) {
            appConfig.setTagSelectedID(tags[0].id);
          }
        }
      }),
    [appConfig.tagSearchString]
  );

  if (!user) {
    return <></>;
  }

  return <TagList tagsFromWrapper={tags} username={user} />;
};

export default React.memo(observer(TagListWrapper));
