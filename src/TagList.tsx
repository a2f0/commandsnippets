import * as Constants from './constants';
import {ITagJsonApi, TagHelpers} from './models/TagModel';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {IMouse} from './Entry';
import {ITagJsonApiResponseSingle} from './lib/tags';
import List from '@mui/material/List';
import Tag from './Tag';
import TagListContextMenu from './TagListContextMenu';
import TagNew from './TagNew';
import {autorun} from 'mobx';
import {keyCode} from './lib/shared';
import makeStyles from '@mui/styles/makeStyles';
import {observer} from 'mobx-react';
import update from 'immutability-helper';
import {useAppContext} from './AppContext';
import {useHistory} from 'react-router-dom';
import {useParams} from 'react-router-dom';

const useStyles = makeStyles({
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
  const history = useHistory();
  const {user} = useParams<IParamTypes>();

  // Used to access the react state from within the listener.
  const [tags, _setTags] = useState<Array<ITagJsonApi>>([]);
  const tagsRef = useRef(tags);
  const setTags = (data: Array<ITagJsonApi>) => {
    tagsRef.current = data;
    _setTags(data);
  };

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
          const array = TagHelpers.filterAndSort();
          if (array.length > 1) {
            appConfig.setTagSelectedID(array[0].id);
            const selected = appConfig.tagsArray.find(
              c => c.id === array[0].id
            );
            if (selected !== undefined) {
              history.push(`/${user}/${selected.attributes.name}`);
            }
          }
          setTags(array);
        });
      }),
    [appConfig.tagSortOrder]
  );

  useEffect(
    () =>
      autorun(() => {
        setTags(TagHelpers.filterAndSort());
        if (tags.length === 1) {
          appConfig.setTagSelectedID(tags[0].id);
          appConfig.setTagsOrEntries('entries');
        } else if (tags.length > 1) {
          appConfig.setTagSelectedID(tags[0].id);
        }
      }),
    [appConfig.tagSearchString]
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
    setTags(TagHelpers.filterAndSort());
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
    setTags(TagHelpers.filterAndSort());
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

  const keyListener = useCallback(
    event => {
      const trappedKeyCodes = [
        keyCode.UpArrow,
        keyCode.DownArrow,
        keyCode.Enter,
      ];
      if (
        trappedKeyCodes.includes(event.keyCode) &&
        appConfig.tagsOrEntries === 'tags'
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
      const selected = tagsRef.current.find(
        c => c.id === appConfig.tagSelectedID
      );
      if (selected !== undefined && appConfig.tagsOrEntries === 'tags') {
        const selectedIndex = tagsRef.current.indexOf(selected);
        if (selectedIndex !== -1) {
          if (event.keyCode === keyCode.UpArrow) {
            const newIndex = selectedIndex - 1;
            if (newIndex >= 0) {
              appConfig.setTagSelectedID(tagsRef.current[newIndex].id);
            }
          } else if (event.keyCode === keyCode.DownArrow) {
            const newIndex = selectedIndex + 1;
            if (newIndex <= tagsRef.current.length - 1) {
              appConfig.setTagSelectedID(tagsRef.current[newIndex].id);
            }
          } else if (event.keyCode === keyCode.Enter) {
            appConfig.setTagsOrEntries('entries');
            history.push(`/${user}/${selected.attributes.name}`);
          }
        }
      }
    },
    [tags]
  );

  useEffect(() => {
    document.addEventListener('keydown', keyListener, false);

    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, []);

  return (
    <>
      <List
        sx={{
          paddingTop: theme => `${theme.main.paddingTop}`,
          paddingBottom: 0,
          paddingLeft: 0,
          paddingRight: 0,
          overflowY: 'auto',
          direction: 'rtl',
          height: `calc(100vh - ${Constants.appBarHeight}px - ${Constants.footerHeight}px)`,
        }}
        onContextMenu={handleContextClick}
      >
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
