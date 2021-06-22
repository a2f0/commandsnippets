import {ITag, ITextEntry} from './Entry';
import React, {useEffect, useState} from 'react';
import {useLocation, useParams} from 'react-router-dom';
import API from './api';
import Entry from './Entry';
import ItemTypes from './ItemTypes';
import {autorun} from 'mobx';
import {observer} from 'mobx-react';
import update from 'immutability-helper';
import {useAppContext} from './AppContext';
import {useDrop} from 'react-dnd';

interface IParamTypes {
  user: string;
  tag: string;
}

interface ITagsEntriesData {
  data: Array<TagTextEntryThroughModel>;
  included: (ITag | ITextEntry)[];
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
  const [data, setData] = useState<ITagsEntriesData>({
    data: [],
    included: [],
  });
  const location = useLocation();
  const {user} = useParams<IParamTypes>();
  const {tag} = useParams<IParamTypes>();

  useEffect(
    () =>
      autorun(() => {
        retrieveEntries();
      }),
    [location]
  );

  const retrieveEntries = () => {
    const fetchData = async () => {
      let url_query_query_string =
        '/tags_entries?' + 'sort=' + appConfig.entrySortOrder;
      if (user !== undefined) {
        url_query_query_string += '&filter[user.username]=' + user;
      }
      if (tag !== undefined) {
        url_query_query_string += '&filter[tag.name]=' + tag;
      }
      const response = await API.get(url_query_query_string);
      setData(response.data);
      appConfig.setCurrentTag(tag);
    };
    fetchData();
  };
  const moveEntry = (id: string, atIndex: number) => {
    const {entry, index} = findEntry(id);
    const reordered = update(data.data, {
      $splice: [
        [index, 1],
        [atIndex, 0, entry],
      ],
    });
    const newData = {...data, data: reordered};
    setData(newData);
  };
  const findEntry = (id: string) => {
    const entry = data.data.filter(c => c.id === id)[0];
    return {
      entry,
      index: data.data.indexOf(entry),
    };
  };

  const findEntryByIndex = (index: number) => {
    if (index > data.data.length - 1) {
      return null;
    } else {
      return data.data[index];
    }
  };

  const [, drop] = useDrop({accept: ItemTypes.ENTRY});

  const handleDelete = (id: string) => {
    const new_data = data.data.filter(item => item.id !== id);
    const newData = {...data, data: new_data};
    setData(newData);
  };

  // User-defined type guard.
  function isTextEntry(argument: ITextEntry | ITag): argument is ITextEntry {
    return (argument as ITextEntry).type === 'TextEntry';
  }

  return (
    <div ref={drop} id="tagsEntriesList">
      {data.data.map((entry, i) => {
        const text_entries = data.included.filter(isTextEntry);
        const text_entry = text_entries.filter(
          i => i.id === entry.relationships.text_entry.data.id
        )[0];

        const tag = data.included.filter(
          i => i.type === 'Tag' && i.id === entry.relationships.tag.data.id
        )[0];

        return (
          <Entry
            key={entry.id}
            id={entry.id}
            index={i}
            moveEntry={moveEntry}
            findEntry={findEntry}
            handleDelete={handleDelete}
            text_entry={text_entry}
            tag={tag}
            retrieveEntries={retrieveEntries}
            findEntryByIndex={findEntryByIndex}
          />
        );
      })}
    </div>
  );
};

export default React.memo(observer(EntryList));
