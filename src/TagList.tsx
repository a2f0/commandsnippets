import React, {useEffect, useState} from 'react';
import Tag from './Tag';
import TagSearch from './TagSearch';
import List from '@material-ui/core/List';
import {makeStyles} from '@material-ui/core/styles';
import API from './api';
import {autorun} from 'mobx';
import TagNew from './TagNew';
import {useAppContext} from './AppContext';
import {observer} from 'mobx-react';
import {useParams, useHistory} from 'react-router-dom';
import * as Constants from './constants';
import update from 'immutability-helper';

const useStyles = makeStyles({
  root: {
    paddingTop: 2,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    overflowY: 'auto',
    direction: 'rtl',
    height: `calc(100vh - ${Constants.appBarHeight}px)`,
  },
  ltr: {
    direction: 'ltr',
  },
  item: {
    display: 'inline-block',
    marginLeft: `${Constants.dragIndicatorWidthTag}px`,
  },
});

interface IParamTypes {
  user: string;
}

interface IRelationships {
  [key: string]: IRelationshipData;
}

interface IRelationshipData {
  data: {
    type: string;
    id: number;
  };
}

interface ITagsData {
  data: Array<ITag>;
  included: Array<IUser>;
}

export interface IUser {
  id: number;
  type: string;
  attributes: {
    username: string;
  };
}

export interface ITag {
  id: number;
  type: string;
  attributes: {
    name: string;
    entry_count: number;
  };
  relationships: IRelationships;
}

const TagList = React.memo(
  observer(() => {
    const appConfig = useAppContext();
    const [data, setData] = useState<ITagsData>({data: [], included: []});
    const {user} = useParams<IParamTypes>();
    const history = useHistory();

    useEffect(
      () =>
        autorun(() => {
          fetchTags();
        }),
      [window.location]
    );

    async function fetchTags() {
      let data: Array<ITag> = [];
      let included: Array<IUser> = [];
      let nextPage = null;
      let page = 0;

      do {
        const {data: response} = await API.get('/tags', {
          params: {
            'page[number]': ++page,
            sort: appConfig.tagSortOrder,
          },
        });
        nextPage = response.links.next;
        data = data.concat(response.data);
        included = included.concat(response.included);
      } while (nextPage !== null);
      setData({data: data, included: included});
    }

    const handleNavigateToUntaggedEntries = () => {
      // untagged-entries
      history.push(`/${user}/untagged-entries`);
      appConfig.setMainPanel('UntaggedEntryList');
    };

    const classes = useStyles();

    const moveEntry = (id: number, atIndex: number) => {
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

    const findEntry = (id: number) => {
      const entry = data.data.filter(c => c.id === id)[0];
      return {
        entry: entry,
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

    return (
      <>
        {appConfig.tagSearch && <TagSearch />}
        <List className={classes.root}>
          <div className={classes.ltr}>
            {appConfig.tagNew && <TagNew fetchTags={fetchTags} />}
            {data.data.map((tag: ITag, i) => {
              const user: IUser = data.included.filter(
                i =>
                  i.type === 'User' && i.id === tag.relationships.user.data.id
              )[0];
              return (
                <div key={tag.id}>
                  <Tag
                    id={tag.id}
                    tag={tag}
                    user={user}
                    fetchTags={fetchTags}
                    moveEntry={moveEntry}
                    findEntry={findEntry}
                    index={i}
                    findEntryByIndex={findEntryByIndex}
                  />
                </div>
              );
            })}
            <div className={classes.item}>
              <div onClick={handleNavigateToUntaggedEntries}>untagged</div>
            </div>
          </div>
        </List>
      </>
    );
  })
);
export default TagList;
