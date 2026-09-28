import {observer} from 'mobx-react';
import React from 'react';
import Highlighter from 'react-highlight-words';

import {useAppContext} from '../../AppContext';
import type {ITextEntryJsonApi} from '../../lib/api/responses/types';

export interface IProps {
  object: ITextEntryJsonApi;
}

const style = {
  fontSize: 14,
};

const EntrySubject = ({object}: IProps) => {
  const appConfig = useAppContext();

  return (
    <Highlighter
      style={style}
      searchWords={[`${appConfig.entrySearchString}`]}
      autoEscape={true}
      textToHighlight={object.attributes.subject}
    />
  );
};

export const MemoizedEntrySubject = React.memo(observer(EntrySubject));
