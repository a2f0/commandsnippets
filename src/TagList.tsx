import * as Constants from './constants';
import {ITagJsonApi, TagHelpers} from './models/TagModel';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {IMouse} from './Entry';
import {ITagJsonApiResponseSingle} from './lib/tags';
import List from '@material-ui/core/List';
import Tag from './Tag';
import TagListContextMenu from './TagListContextMenu';
import TagNew from './TagNew';
import TagSearch from './TagSearch';
import {autorun} from 'mobx';
import {makeStyles} from '@material-ui/core/styles';
import {observer} from 'mobx-react';
import update from 'immutability-helper';
import {useAppContext} from './AppContext';
import {useParams} from 'react-router-dom';

const useStyles = makeStyles({
  root: {
    paddingTop: 2,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    overflowY: 'auto',
    direction: 'rtl',
    height: `calc(100vh - ${Constants.appBarHeight}px)`,
  },
  ltr: {
    direction: 'ltr',
  },
  item: {
    display: 'inline-block',
    marginLeft: `${Constants.dragIndicatorWidthTag}px`,
  },
  untaggedEntries: {
    width: '100%',
    direction: 'ltr',
    paddingLeft: `${Constants.dragIndicatorWidthTag}px`,
  },
});

interface IParamTypes {
  user: string;
  tag: string;
}

export interface IUser {
  id: number;
  type: string;
  attributes: {
    username: string;
  };
}

const TagList = () => {
  const appConfig = useAppContext();
  const {user} = useParams<IParamTypes>();
  const [tags, setTags] = useState<Array<ITagJsonApi>>([]);

  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mouse, setMouse] = useState(initialMouse);

  useEffect(
    () =>
      autorun(() => {
        appConfig.setCurrentUser(user);
        appConfig.fetchTags(user).then(() => {
          setTags(TagHelpers.sort());
        });
      }),
    [appConfig.tagSortOrder]
  );

  const classes = useStyles();

  const moveEntry = useCallback(
    (id: string, atIndex: number) => {
      const entry = tags.filter(c => c.id === id)[0];
      const entryIndex = tags.indexOf(entry);
      setTags(
        update(tags, {
          $splice: [
            [entryIndex, 1],
            [atIndex, 0, entry],
          ],
        })
      );
    },
    [tags]
  );

  const handleDelete = (object: ITagJsonApiResponseSingle) => {
    const existing = appConfig.tagsArray.find(c => c.id === object.data.id);
    existing?.update(object.data);
    setTags(TagHelpers.sort());
  };

  const findEntry = (id: string) => {
    const entry = tags.filter(c => c.id === id)[0];
    return {
      entry: entry,
      index: tags.indexOf(entry),
    };
  };

  const handleNew = (object: ITagJsonApi) => {
    appConfig.updateOrCreateTag(object);
    setTags(TagHelpers.sort());
  };

  const findEntryByIndex = (index: number) => {
    if (index > tags.length - 1) {
      return null;
    } else {
      return tags[index];
    }
  };

  const handleContextClick = (event: React.MouseEvent<HTMLUListElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const mouseData: IMouse = {...mouse};
    (mouseData.mouseX = event.clientX - 2),
      (mouseData.mouseY = event.clientY - 4),
      setMouse(mouseData);
  };

  const contextMenu = useMemo(
    () => <TagListContextMenu mouse={mouse} />,
    [mouse]
  );

  return (
    <>
      {appConfig.tagSearch && <TagSearch />}
      <List className={classes.root} onContextMenu={handleContextClick}>
        <div className={classes.ltr} id="tagList">
          {appConfig.tagNew === 'top' && <TagNew handleNewParent={handleNew} />}
          {tags.map((object: ITagJsonApi, i) => {
            return (
              <Tag
                key={object.id}
                object={object}
                id={object.id}
                handleDeleteParent={handleDelete}
                moveEntry={moveEntry}
                findEntry={findEntry}
                index={i}
                findEntryByIndex={findEntryByIndex}
              />
            );
          })}
          {appConfig.tagNew === 'bottom' && (
            <TagNew handleNewParent={handleNew} />
          )}
        </div>
        {appConfig.loggedInUser && <>{contextMenu}</>}
      </List>
    </>
  );
};

export default React.memo(observer(TagList));
