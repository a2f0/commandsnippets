import React, {useState, useEffect} from 'react';
import API from './api';
import {autorun} from 'mobx';
import {useAppContext} from './AppContext';
import {observer} from 'mobx-react';
import {useLocation} from 'react-router-dom';
import UntaggedEntry from './UntaggedEntry';
import {ITextEntry} from './Entry';

const width = {
  width: '100%',
};

const UntaggedEntryList = React.memo(
  observer(function UntaggedEntryList() {
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
          appConfig.entrySortOrder +
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
  })
);
export default UntaggedEntryList;
