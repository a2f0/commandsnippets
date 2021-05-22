import React, {useState, useEffect, useContext} from 'react';
import {useDrop} from 'react-dnd';
import Entry from './Entry.jsx';
import update from 'immutability-helper';
import ItemTypes from './ItemTypes';
import API from './api.ts';
import {autorun} from 'mobx';
import AppContext from './AppContext.js';
import {observer} from 'mobx-react';
import {useLocation, useParams} from 'react-router-dom';

const EntryList = React.memo(
  observer(function EntryList() {
    const appConfig = useContext(AppContext);
    const [data, setData] = useState({data: [], included: []});
    const location = useLocation();
    const {user} = useParams();
    const {tag} = useParams();

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
      };
      fetchData();
    };
    const moveEntry = (id, atIndex) => {
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
    const findEntry = id => {
      const entry = data.data.filter(c => `${c.id}` === id)[0];
      return {
        entry,
        index: data.data.indexOf(entry),
      };
    };

    const findEntryByIndex = index => {
      if (index > data.data.length - 1) {
        return null;
      } else {
        return data.data[index];
      }
    };

    const [, drop] = useDrop({accept: ItemTypes.ENTRY});

    const handleDelete = id => {
      const new_data = data.data.filter(item => item.id !== id);
      const newData = {...data, data: new_data};
      setData(newData);
    };

    return (
      <div ref={drop}>
        {data.data.map((entry, i) => {
          const text_entry = data.included.filter(
            i =>
              i.type === 'TextEntry' &&
              i.id === entry.relationships.text_entry.data.id
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
  })
);
export default EntryList;
