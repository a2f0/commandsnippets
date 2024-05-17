import React, {useEffect} from 'react';
import Highlighter from 'react-highlight-words';
import {autorun} from 'mobx';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';

interface IProps {
  label: string;
}

const TagLabel = ({label}: IProps) => {
  const appConfig = useAppContext();

  useEffect(() => autorun(() => {}), [appConfig.tagSearchString]);

  return (
    <Highlighter
      searchWords={[`${appConfig.tagSearchString}`]}
      autoEscape={true}
      textToHighlight={label}
    />
  );
};
export default React.memo(observer(TagLabel));
