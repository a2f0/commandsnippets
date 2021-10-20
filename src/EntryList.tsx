import {ITextEntryJsonApi, TextEntryHelpers} from './models/TextEntryModel';
import React, {useEffect, useState} from 'react';
import {useLocation, useParams} from 'react-router-dom';
import Entry from './Entry';
import ItemTypes from './ItemTypes';
import {autorun} from 'mobx';
import {observer} from 'mobx-react';
import update from 'immutability-helper';
import {useAppContext} from './AppContext';
import {useDrop} from 'react-dnd';

export interface IParamTypes {
  user: string;
  tag: string;
}

interface IRelationships {
  [key: string]: IRelationship;
}

interface IRelationship {
  [key: string]: IRelationshipData;
}

interface IRelationshipData {
  type: string;
  id: string;
}

export interface TagTextEntryThroughModel {
  type: string;
  id: string;
  relationships: IRelationships;
  index: number;
}

const EntryList = () => {
  const appConfig = useAppContext();
  const location = useLocation();
  const {user} = useParams<IParamTypes>();
  const {tag} = useParams<IParamTypes>();
  const [entries, setEntries] = useState<Array<ITextEntryJsonApi>>([]);

  useEffect(
    () =>
      autorun(() => {
        retrieveEntries();
      }),
    [location]
  );

  const retrieveEntries = () => {
    const fetchData = async () => {
      if (tag !== undefined) {
        appConfig.fetchTextEntries(user, tag).then(() => {
          sortAndFilter();
        });
      }
    };
    fetchData();
  };

  const sortAndFilter = () => {
    setEntries(TextEntryHelpers.sort(user, tag));
  };

  const moveEntry = (id: string, atIndex: number) => {
    const {entry, index} = findEntry(id);
    const reordered = update(entries, {
      $splice: [
        [index, 1],
        [atIndex, 0, entry],
      ],
    });
    setEntries(reordered);
  };

  const findEntry = (id: string) => {
    const entry = entries.filter(c => c.id === id)[0];
    return {
      entry,
      index: entries.indexOf(entry),
    };
  };
  const findEntryByIndex = (index: number) => {
    if (index > entries.length - 1) {
      return null;
    } else {
      return entries[index];
    }
  };

  const [, drop] = useDrop({accept: ItemTypes.ENTRY});

  const handleUntag = (id: string) => {
    setEntries(
      entries.filter(element => {
        return element.id !== id;
      })
    );
  };

  return (
    <div ref={drop} id="tagsEntriesList">
      {entries.map((element, i) => {
        return (
          <Entry
            key={element.id}
            id={element.id}
            index={i}
            moveEntry={moveEntry}
            findEntry={findEntry}
            handleUntagParent={handleUntag}
            object={element}
            sortAndFilterParent={sortAndFilter}
            findEntryByIndex={findEntryByIndex}
          />
        );
      })}
    </div>
  );
};

export default React.memo(observer(EntryList));
