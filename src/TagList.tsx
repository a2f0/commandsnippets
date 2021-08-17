import * as Constants from './constants';
import React, {useEffect} from 'react';
import {Instance} from 'mobx-state-tree';
import List from '@material-ui/core/List';
import Tag from './Tag';
import {TagJsonAPI} from './AppStateStore';
import TagNew from './TagNew';
import TagSearch from './TagSearch';
import {autorun} from 'mobx';
import {makeStyles} from '@material-ui/core/styles';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';
import {useParams} from 'react-router-dom';

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
  untaggedEntries: {
    width: '100%',
    direction: 'ltr',
    paddingLeft: `${Constants.dragIndicatorWidthTag}px`,
  },
});

interface IParamTypes {
  user: string;
  tag: string;
}

export interface IUser {
  id: number;
  type: string;
  attributes: {
    username: string;
  };
}

export interface ITagJsonApi {
  id: string;
  type: string;
  attributes: ITagJsonApiAttributes;
}

export interface ITagJsonApiAttributes {
  name: string;
  entry_count: number;
  order: number;
  date_updated: string;
  date_created: string;
  date_last_used: string;
}

const TagList = () => {
  const appConfig = useAppContext();
  const {user} = useParams<IParamTypes>();

  useEffect(
    () =>
      autorun(() => {
        appConfig.fetchTags(user);
      }),
    []
  );

  const classes = useStyles();

  const moveEntry = (id: string, atIndex: number) => {
    appConfig.moveTagEntry(id, atIndex);
  };

  const findEntry = (id: string) => {
    const entry = appConfig.tagsArray.filter(c => c.id === id)[0];
    return {
      entry: entry,
      index: appConfig.tagsArray.indexOf(entry),
    };
  };

  const findEntryByIndex = (index: number) => {
    if (index > appConfig.tagsArray.length - 1) {
      return null;
    } else {
      return appConfig.tagsArray[index];
    }
  };

  return (
    <>
      {appConfig.tagSearch && <TagSearch />}
      <List className={classes.root}>
        <div className={classes.ltr} id="tagList">
          {appConfig.tagNew && <TagNew />}
          {appConfig.tagsArray.map((object: Instance<typeof TagJsonAPI>, i) => {
            return (
              <Tag
                key={object.id}
                object={object}
                id={object.id}
                moveEntry={moveEntry}
                findEntry={findEntry}
                index={i}
                findEntryByIndex={findEntryByIndex}
              />
            );
          })}
        </div>
      </List>
    </>
  );
};

export default React.memo(observer(TagList));
