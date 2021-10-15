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
        appConfig.setCurrentTag(tag);
        appConfig.fetchTextEntries(user, tag);
        setEntries(TextEntryHelpers.sort());
      }
    };
    fetchData();
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

  const handleDelete = (id: string) => {
    console.info('handle delete id: ' + id);
  };

  return (
    <div ref={drop} id="tagsEntriesList">
      {entries.map((text_entry, i) => {
        return (
          <Entry
            key={text_entry.id}
            id={text_entry.id}
            index={i}
            moveEntry={moveEntry}
            findEntry={findEntry}
            handleDelete={handleDelete}
            text_entry={text_entry}
            retrieveEntries={retrieveEntries}
            findEntryByIndex={findEntryByIndex}
          />
        );
      })}
    </div>
  );
};

export default React.memo(observer(EntryList));
