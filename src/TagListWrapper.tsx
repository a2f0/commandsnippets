import {autorun} from 'mobx';
import {observer} from 'mobx-react';
import type {Instance} from 'mobx-state-tree';
import React, {useEffect, useRef, useState} from 'react';
import {useLocation, useParams} from 'react-router-dom';
import {useNavigate} from 'react-router-dom';

import {useAppContext} from './AppContext';
import {type ITagJsonApi, TagHelpers} from './lib/store/models/TagModel';
import type {TagModel} from './lib/store/models/TagModel';
import {TagList} from './TagList';

export interface IUser {
  id: number;
  type: string;
  attributes: {
    username: string;
  };
}

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
          let selected: Instance<typeof TagModel> | undefined;
          if (tag) {
            // Then its a URL query param
            selected = appConfig.tagsArray.find(c => c.attributes.name === tag);
          } else {
            // Then its the first tag in the list
            const firstTag = array[0];
            if (firstTag !== undefined) {
              selected = appConfig.tagsArray.find(c => c.id === firstTag.id);
            }
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
          if (tags[0]) {
            appConfig.setTagSelectedID(tags[0].id);
          }
        }
      }),
    [appConfig.tagSearchString]
  );

  if (!user) {
    return;
  }

  return <TagList tagsFromWrapper={tags} username={user} />;
};

const memoizedTagListWrapper = React.memo(observer(TagListWrapper));
export {memoizedTagListWrapper as TagListWrapper};
