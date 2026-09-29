import React from 'react';
import Highlighter from 'react-highlight-words';
import type {ITextEntryJsonApi} from '../../lib/api/responses/types';
import {useAppConfig} from '../../lib/state/appState';

export interface IProps {
  object: ITextEntryJsonApi;
}

const style = {
  fontSize: 14,
};

const EntrySubject = ({object}: IProps) => {
  const appConfig = useAppConfig();

  return (
    <Highlighter
      style={style}
      searchWords={[`${appConfig.entrySearchString}`]}
      autoEscape={true}
      textToHighlight={object.attributes.subject}
    />
  );
};

export const MemoizedEntrySubject = React.memo(EntrySubject);
