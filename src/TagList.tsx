import {IMouse, activeSearch, appMode, initialMouse} from './lib/shared';
import {ITagJsonApi, TagHelpers} from './models/TagModel';
import {List, ListItem, ListItemButton} from '@mui/material';
import React, {
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {ITag} from './lib/db/types';
import {ITagJsonApiResponseSingle} from './lib/tags';
import ItemTypes from './ItemTypes';
import Tag from './Tag';
import TagListContextMenu from './TagListContextMenu';
import TagNew from './TagNew';
import {autorun} from 'mobx';
import {convertISO8601ToUnixTime} from './lib/util/dateTime';
import {needsScrollingIntoView} from './lib/text_entries';
import {observer} from 'mobx-react';
import {styled} from '@mui/material/styles';
import update from 'immutability-helper';
import {useAppContext} from './AppContext';
import {useDrop} from 'react-dnd';
import {useNavigate} from 'react-router-dom';
import {useTheme} from '@mui/material/styles';

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

interface IProps {
  tagsFromWrapper: ITagJsonApi[];
  username: string;
}
const TagList = ({tagsFromWrapper, username}: IProps) => {
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const theme = useTheme();

  const [tags, _setTags] = useState<Array<ITagJsonApi>>(tagsFromWrapper);
  // Used to access the react state from keyListener.
  const tagsRef = useRef(tags);
  const setTags = (data: Array<ITagJsonApi>) => {
    tagsRef.current = data;
    _setTags(data);
  };

  const [elRefs, _setElRefs] = useState<Array<React.RefObject<HTMLLIElement>>>(
    []
  );
  // Used to access the react state from keyListener.
  const elRefsRef = useRef(elRefs);
  const setElRefs = (data: Array<React.RefObject<HTMLLIElement>>) => {
    elRefsRef.current = data;
    _setElRefs(data);
  };
  useEffect(() => {
    const refsArray = Array<React.RefObject<HTMLLIElement>>(tags.length);
    for (let index = 0; index < refsArray.length; index++) {
      refsArray[index] = createRef<HTMLLIElement>();
    }
    setElRefs(refsArray);
  }, [tags.length]);

  const [mouse, setMouse] = useState(initialMouse);

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

  const handleDelete = useCallback((o: ITagJsonApiResponseSingle) => {
    const existing = appConfig.tagsArray.find(c => c.id === o.data.id);
    existing?.update(o.data);
    setTags(TagHelpers.filterAndSort(appConfig));
  }, []);

  const findEntry = useCallback(
    (id: string) => {
      const entry = tags.filter(c => c.id === id)[0];
      return {
        entry,
        index: tags.indexOf(entry),
      };
    },
    [tags]
  );

  const findEntryByIndex = useCallback(
    (index: number) => {
      if (index > tags.length - 1) {
        return null;
      } else {
        return tags[index];
      }
    },
    [tags]
  );

  const moveEntry = useCallback(
    (id: string, atIndex: number) => {
      const {entry, index} = findEntry(id);
      console.info(
        `moveEntry: ${entry.attributes.name} index ${index} moving to ${atIndex}`
      );
      const reordered = update(tags, {
        $splice: [
          [index, 1],
          [atIndex, 0, entry],
        ],
      });
      setTags(reordered);
    },
    [findEntry, findEntryByIndex, tags, setTags]
  );

  const handleNew = () => {
    setTags(TagHelpers.filterAndSort(appConfig));
  };

  const [, drop] = useDrop({accept: ItemTypes.ENTRY});

  const handleContextClick = useCallback(
    (event: React.MouseEvent<HTMLUListElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const mouseData: IMouse = {...mouse};
      (mouseData.mouseX = event.clientX - 2),
        (mouseData.mouseY = event.clientY - 4),
        setMouse(mouseData);
    },
    []
  );

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
          if (event.key === 'ArrowUp') {
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
          } else if (event.key === 'ArrowDown') {
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
          } else if (event.key === 'Enter') {
            appConfig.setAppMode(appMode.entriesList);
            appConfig.setActiveSearch(activeSearch.entries);
            navigate(`/${username}/${selected.attributes.name}`);
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
      {appConfig.tagNew === 'top' && (
        <TagNew id="tagNewTop" handleNewParent={handleNew} />
      )}
      <List
        ref={drop}
        dense={true}
        id="tagList"
        sx={{
          paddingTop: theme => `${theme.main.paddingTop}`,
          paddingBottom: 0,
          paddingLeft: 0,
          paddingRight: 0,
          overflowY: 'auto',
          direction: 'rtl',
          height: theme =>
            `calc(100vh - ${theme.appBar.height}px - ${theme.footer.height}px)`,
        }}
        onContextMenu={handleContextClick}
      >
        <LeftToRight>
          {tags.map((object: ITagJsonApi, i) => {
            const updated = convertISO8601ToUnixTime(
              object.attributes.date_updated
            );
            const tag: ITag = {
              id: object.id,
              name: object.attributes.name,
              entryCount: object.attributes.entry_count,
              updated,
              userId: object.relationships.user.data.id,
              synced: false,
              deleted: object.attributes.is_deleted,
            };

            return (
              <ListItem
                // key={tag.id}
                key={object.id}
                sx={{
                  padding: 0,
                }}
                ref={elRefs[i]}
              >
                <ListItemButton
                  data-testid={`tagListButton-${object.id}`}
                  sx={{
                    padding: 0,
                  }}
                >
                  <Tag
                    object={tag}
                    id={object.id}
                    handleDeleteParent={handleDelete}
                    moveEntry={moveEntry}
                    findEntry={findEntry}
                    index={i}
                    findEntryByIndex={findEntryByIndex}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </LeftToRight>
        {appConfig.tagNew === 'bottom' && (
          <TagNew id="tagNewBottom" handleNewParent={handleNew} />
        )}
        {appConfig.loggedInUser && <>{contextMenu}</>}
      </List>
    </>
  );
};

export default React.memo(observer(TagList));
