import {ITagJsonApi, TagHelpers} from './models/TagModel';
import React, {
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {activeSearch, appMode, needsScrollingIntoView} from './lib/shared';
import {IMouse} from './Entry';
import type {ITag} from './lib/db/types';
import {ITagJsonApiResponseSingle} from './lib/tags';
import {List} from '@mui/material';
import Tag from './Tag';
import TagListContextMenu from './TagListContextMenu';
import TagNew from './TagNew';
import {autorun} from 'mobx';
import {convertISO8601ToUnixTime} from './lib/util/dateTime';
import {observer} from 'mobx-react';
import {styled} from '@mui/material/styles';
import update from 'immutability-helper';
import {useAppContext} from './AppContext';
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

  const [elRefs, _setElRefs] = useState<Array<React.RefObject<HTMLDivElement>>>(
    []
  );
  // Used to access the react state from keyListener.
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

  const moveEntry = useCallback((dragIndex: number, hoverIndex: number) => {
    _setTags((prevTags: ITagJsonApi[]) =>
      update(prevTags, {
        $splice: [
          [dragIndex, 1],
          [hoverIndex, 0, prevTags[dragIndex] as ITagJsonApi],
        ],
      })
    );
  }, []);

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
    <List
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
        {appConfig.tagNew === 'top' && (
          <TagNew id="tagNewTop" handleNewParent={handleNew} />
        )}
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
          };
          return (
            <div key={object.id} ref={elRefs[i]}>
              <Tag
                object={tag}
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
      </LeftToRight>
      {appConfig.loggedInUser && <>{contextMenu}</>}
    </List>
  );
};

export default React.memo(observer(TagList));
