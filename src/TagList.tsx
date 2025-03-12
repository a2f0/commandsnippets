import {List} from '@mui/material';
import {styled} from '@mui/material/styles';
import update from 'immutability-helper';
import {autorun} from 'mobx';
import {observer} from 'mobx-react';
import React, {
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useDrop} from 'react-dnd';
import {useNavigate} from 'react-router-dom';
import invariant from 'invariant';
import {useAppContext} from './AppContext';
import ItemTypes from './ItemTypes';
import {activeSearch, appMode, IMouse, initialMouse} from './lib/shared';
import {ITagJsonApiResponseSingle} from './lib/tags';
import {ITagJsonApi, TagHelpers} from './models/TagModel';
import Tag from './Tag';
import TagListContextMenu from './TagListContextMenu';
import TagNew from './TagNew';

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

  const [selectedTag, _setSelectedTag] = useState<string>();
  const selectedTagRef = useRef(selectedTag);

  const [movedSelectedUp, setMovedSelectedUp] = useState<boolean>(false);

  const setSelectedTag = useCallback((id: string) => {
    selectedTagRef.current = id;
    _setSelectedTag(id);
  }, []);

  const [tags, _setTags] = useState<Array<ITagJsonApi>>(tagsFromWrapper);
  // Used to access the react state from keyListener.
  const tagsRef = useRef(tags);
  const setTags = useCallback(
    (data: Array<ITagJsonApi>) => {
      tagsRef.current = data;
      _setTags(data);
    },
    [_setTags]
  );

  const [elRefs, _setElRefs] = useState<
    Array<React.RefObject<HTMLLIElement | null>>
  >([]);
  // Used to access the react state from keyListener.
  const elRefsRef = useRef(elRefs);
  const setElRefs = (data: Array<React.RefObject<HTMLLIElement | null>>) => {
    elRefsRef.current = data;
    _setElRefs(data);
  };
  useEffect(() => {
    const refsArray = Array<React.RefObject<HTMLLIElement | null>>(tags.length);
    for (let index = 0; index < refsArray.length; index++) {
      refsArray[index] = createRef<HTMLLIElement>();
    }
    setElRefs(refsArray);
  }, [tags.length]);

  const [mouse, setMouse] = useState(initialMouse);

  useEffect(
    () =>
      autorun(() => {
        const tags = TagHelpers.filterAndSort(appConfig);
        setTags(TagHelpers.filterAndSort(appConfig));
        const current = tags.find(
          element => element.id === appConfig.tagSelectedID
        );
        if (current === undefined) {
          if (tags[0]) {
            console.info(
              `set selected tag ${tags[0].attributes.name} id ${tags[0].id}`
            );
            setSelectedTag(tags[0].id);
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
      invariant(entry, 'entry is not defined');
      return {
        entry,
        index: tags.indexOf(entry),
      };
    },
    [tags]
  );

  const findEntryByIndex = useCallback(
    (index: number): ITagJsonApi | null => {
      if (index > tags.length - 1) {
        return null;
      } else {
        invariant(tags[index], 'tag is undefined');
        return tags[index];
      }
    },
    [tags]
  );

  const moveEntry = useCallback(
    (id: string, atIndex: number) => {
      const {entry, index} = findEntry(id);
      invariant(entry, 'entry is undefined');
      console.debug(
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
    [findEntry, findEntryByIndex, tags]
  );

  const handleNew = () => {
    setTags(TagHelpers.filterAndSort(appConfig));
  };

  const [, drop] = useDrop({accept: ItemTypes.ENTRY});

  // Add this function to properly connect the drop ref
  const dropBoxRef = (el: HTMLUListElement | null) => {
    drop(el);
  };

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
        c => c.id === selectedTagRef.current
      );
      if (selected !== undefined && appConfig.appMode === appMode.tagsList) {
        const selectedIndex = tagsRef.current.indexOf(selected);
        if (selectedIndex !== -1) {
          if (event.key === 'ArrowUp') {
            const newIndex = selectedIndex - 1;
            invariant(tagsRef.current[newIndex], 'tag is undefined');
            if (newIndex >= 0) {
              setSelectedTag(tagsRef.current[newIndex].id);
              setMovedSelectedUp(true);
            }
          } else if (event.key === 'ArrowDown') {
            const newIndex = selectedIndex + 1;
            invariant(tagsRef.current[newIndex], 'tagRef is undefined');
            if (newIndex <= tagsRef.current.length - 1) {
              setSelectedTag(tagsRef.current[newIndex].id);
              setMovedSelectedUp(false);
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
        ref={dropBoxRef}
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
            return (
              <Tag
                object={object}
                key={object.id}
                id={object.id}
                handleDeleteParent={handleDelete}
                moveEntry={moveEntry}
                findEntry={findEntry}
                index={i}
                findEntryByIndex={findEntryByIndex}
                isSelected={object.id === selectedTag}
                movedSelectedUp={
                  object.id === selectedTag ? movedSelectedUp : false
                }
                setSelectedTag={setSelectedTag}
              />
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
