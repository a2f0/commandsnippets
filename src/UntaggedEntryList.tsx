import React, {useEffect, useState} from 'react';
import API from './api';
import {ITextEntry} from './Entry';
import UntaggedEntry from './UntaggedEntry';
import {autorun} from 'mobx';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';
import {useLocation} from 'react-router-dom';

const width = {
  width: '100%',
};

const UntaggedEntryList = () => {
  const appConfig = useAppContext();
  const [data, setData] = useState({data: [], included: []});
  const location = useLocation();

  useEffect(
    () =>
      autorun(() => {
        retrieveEntries();
      }),
    [location]
  );

  const retrieveEntries = () => {
    const fetchData = async () => {
      const url_query_query_string =
        '/entries?' +
        'sort=' +
        appConfig.untaggedEntrySortOrder +
        '&filter[tag_count]=0' +
        '&filter[is_deleted]=False';
      const response = await API.get(url_query_query_string);
      setData(response.data);
    };
    fetchData();
  };

  return (
    <div style={width}>
      {data.data.map((entry: ITextEntry) => {
        return (
          <UntaggedEntry
            key={entry.id}
            id={entry.id}
            entry={entry}
            retrieveEntries={retrieveEntries}
          />
        );
      })}
    </div>
  );
};

export default React.memo(observer(UntaggedEntryList));
