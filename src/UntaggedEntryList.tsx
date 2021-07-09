import React, {useEffect, useState} from 'react';
import API from './api';
import {ITextEntry} from './Entry';
import UntaggedEntry from './UntaggedEntry';
import {autorun} from 'mobx';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';
import {useLocation} from 'react-router-dom';
import {useParams} from 'react-router-dom';

const width = {
  width: '100%',
};

interface IParamTypes {
  user: string;
}

const UntaggedEntryList = () => {
  const appConfig = useAppContext();
  const [data, setData] = useState({data: [], included: []});
  const location = useLocation();
  const {user} = useParams<IParamTypes>();

  useEffect(
    () =>
      autorun(() => {
        retrieveEntries();
      }),
    [location]
  );

  const retrieveEntries = () => {
    const fetchData = async () => {
      const {data} = await API.get('/entries', {
        params: {
          'filter[tag_count]': 0,
          'filter[is_deleted]': false,
          'filter[user.username]': user,
          sort: appConfig.untaggedEntrySortOrder,
        },
      });
      setData(data);
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
