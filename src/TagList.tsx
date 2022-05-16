import * as Constants from './constants';
import {ITagJsonApi, TagHelpers} from './models/TagModel';
import React, {
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  activeSearch,
  appMode,
  keyCode,
  needsScrollingIntoView,
} from './lib/shared';
import {useLocation, useParams} from 'react-router-dom';
import {IMouse} from './Entry';
import {ITagJsonApiResponseSingle} from './lib/tags';
import {Instance} from 'mobx-state-tree';
import List from '@mui/material/List';
import Tag from './Tag';
import TagListContextMenu from './TagListContextMenu';
import {TagModel} from './models/TagModel';
import TagNew from './TagNew';
import {Theme} from '@mui/material/styles';
import {autorun} from 'mobx';
import makeStyles from '@mui/styles/makeStyles';
import {observer} from 'mobx-react';
import update from 'immutability-helper';
import {useAppContext} from './AppContext';
import {useNavigate} from 'react-router-dom';
import {useTheme} from '@mui/styles';

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

export interface IUser {
  id: number;
  type: string;
  attributes: {
    username: string;
  };
}

const TagList = () => {
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const {user} = useParams();
  const {tag} = useParams();
  const theme = useTheme<Theme>();

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

  const [elRefs, _setElRefs] = useState<Array<React.RefObject<HTMLDivElement>>>(
    []
  );
  // Used to access the react state from within the listener.
  const elRefsRef = useRef(elRefs);
  const setElRefs = (data: Array<React.RefObject<HTMLDivElement>>) => {
    elRefsRef.current = data;
    _setElRefs(data);
  };
  useEffect(() => {
    const refsArray = Array<React.RefObject<HTMLDivElement>>(tags.length);
    for (let index = 0; index < refsArray.length; index++) {
      refsArray[index] = createRef<HTMLDivElement>();
    }
    setElRefs(refsArray);
  }, [tags.length]);

  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mouse, setMouse] = useState(initialMouse);

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
    setTags(TagHelpers.filterAndSort(appConfig));
  };

  const findEntry = (id: string) => {
    const entry = tags.filter(c => c.id === id)[0];
    return {
      entry: entry,
      index: tags.indexOf(entry),
    };
  };

  const handleNew = () => {
    setTags(TagHelpers.filterAndSort(appConfig));
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
    (event: KeyboardEvent) => {
      const trappedKeyCodes = ['ArrowUp', 'ArrowDown', 'Enter'];
      if (
        trappedKeyCodes.includes(event.code) &&
        appConfig.appMode === appMode.tagsList
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
      const selected = tagsRef.current.find(
        c => c.id === appConfig.tagSelectedID
      );
      if (selected !== undefined && appConfig.appMode === appMode.tagsList) {
        const selectedIndex = tagsRef.current.indexOf(selected);
        if (selectedIndex !== -1) {
          if (event.keyCode === keyCode.UpArrow) {
            const newIndex = selectedIndex - 1;
            if (newIndex >= 0) {
              appConfig.setTagSelectedID(tagsRef.current[newIndex].id);
              if (
                needsScrollingIntoView(elRefsRef.current?.[newIndex], theme)
              ) {
                elRefsRef.current?.[newIndex].current?.scrollIntoView({
                  behavior: 'auto',
                  block: 'start',
                });
              }
            }
          } else if (event.keyCode === keyCode.DownArrow) {
            const newIndex = selectedIndex + 1;
            if (newIndex <= tagsRef.current.length - 1) {
              appConfig.setTagSelectedID(tagsRef.current[newIndex].id);
              if (
                needsScrollingIntoView(elRefsRef.current?.[newIndex], theme)
              ) {
                elRefsRef.current?.[newIndex].current?.scrollIntoView({
                  behavior: 'auto',
                  block: 'end',
                });
              }
            }
          } else if (event.keyCode === keyCode.Enter) {
            appConfig.setAppMode(appMode.entriesList);
            appConfig.setActiveSearch(activeSearch.entries);
            navigate(`/${userRef.current}/${selected.attributes.name}`);
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
        id="tagList"
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
        <div className={classes.ltr}>
          {appConfig.tagNew === 'top' && (
            <TagNew id="tagNewTop" handleNewParent={handleNew} />
          )}
          {tags.map((object: ITagJsonApi, i) => {
            return (
              <div key={object.id} ref={elRefs[i]}>
                <Tag
                  object={object}
                  id={object.id}
                  handleDeleteParent={handleDelete}
                  moveEntry={moveEntry}
                  findEntry={findEntry}
                  index={i}
                  findEntryByIndex={findEntryByIndex}
                />
              </div>
            );
          })}
          {appConfig.tagNew === 'bottom' && (
            <TagNew id="tagNewBottom" handleNewParent={handleNew} />
          )}
        </div>
        {appConfig.loggedInUser && <>{contextMenu}</>}
      </List>
    </>
  );
};

export default React.memo(observer(TagList));
