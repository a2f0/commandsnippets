import React, {useEffect} from 'react';
import {autorun} from 'mobx';
import {useAppContext} from './AppContext';

interface IProps {
  label: string;
}

const TagLabel = ({label}: IProps) => {
  const appConfig = useAppContext();

  useEffect(() => autorun(() => {}), [appConfig.tagSearchString]);

  return <span>{label}</span>;
};
export default React.memo(TagLabel);
