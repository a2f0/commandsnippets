import {List} from '@mui/material';
import {styled} from '@mui/material/styles';
import invariant from 'invariant';
import {autorun} from 'mobx';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useDrop} from 'react-dnd';
import {useNavigate} from 'react-router-dom';
import {useAppContext} from '../../AppContext';
import type {ITagJsonApiResponseSingle} from '../../lib/api/responses/types';
import {
  activeSearch,
  appMode,
  type IMouse,
  initialMouse,
} from '../../lib/shared';
import {type ITagJsonApi, TagHelpers} from '../../lib/store/models/TagModel';
import {ItemTypes} from '../dnd/itemTypes';
import {Tag} from './Tag';
import {TagListContextMenu} from './TagListContextMenu';
import {TagNew} from './TagNew';

export interface IUser {
  id: number;
  type: string;
  attributes: {
    username: string;
  };
}

export const LeftToRight: React.FC<React.HTMLAttributes<HTMLDivElement>> =
  styled('div')(() => ({
    direction: 'ltr',
  }));

interface IProps {
  tagsFromWrapper: ITagJsonApi[];
  username: string;
}
const TagList = ({tagsFromWrapper, username}: IProps) => {
  const appConfig = useAppContext();
  const navigate = useNavigate();

  const [selectedTag, setSelectedTag] = useState<string>();
  const [movedSelectedUp, setMovedSelectedUp] = useState<boolean>(false);
  const [tags, setTags] = useState<Array<ITagJsonApi>>(tagsFromWrapper);

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

  const handleDelete = useCallback(
    (o: ITagJsonApiResponseSingle) => {
      const existing = appConfig.tagsArray.find(c => c.id === o.data.id);
      existing?.update(o.data);
      setTags(TagHelpers.filterAndSort(appConfig));
    },
    [appConfig]
  );

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
      }
      const tag = tags[index];
      invariant(tag, 'tag is undefined');
      return tag;
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
      const newTags = [...tags];
      newTags.splice(index, 1);
      newTags.splice(atIndex, 0, entry);
      setTags(newTags);
    },
    [findEntry, tags]
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
      mouseData.mouseX = event.clientX - 2;
      mouseData.mouseY = event.clientY - 4;
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
      const selected = tags.find(c => c.id === selectedTag);
      if (selected !== undefined && appConfig.appMode === appMode.tagsList) {
        const selectedIndex = tags.indexOf(selected);
        if (selectedIndex !== -1) {
          if (event.key === 'ArrowUp') {
            const newIndex = selectedIndex - 1;
            if (newIndex >= 0) {
              const tag = tags[newIndex];
              invariant(tag, 'tag is undefined');
              setSelectedTag(tag.id);
              setMovedSelectedUp(true);
            }
          } else if (event.key === 'ArrowDown') {
            const newIndex = selectedIndex + 1;
            if (newIndex <= tags.length - 1) {
              const tag = tags[newIndex];
              invariant(tag, 'tag is undefined');
              setSelectedTag(tag.id);
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
    [appConfig, navigate, username, tags, selectedTag]
  );

  useEffect(() => {
    document.addEventListener('keydown', keyListener, false);

    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, [keyListener]);

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
          <LeftToRight>
            <TagNew id="tagNewBottom" handleNewParent={handleNew} />
          </LeftToRight>
        )}
        {appConfig.loggedInUser && <>{contextMenu}</>}
      </List>
    </>
  );
};

const memoizedTagList = React.memo(observer(TagList));

export {memoizedTagList as TagList};
