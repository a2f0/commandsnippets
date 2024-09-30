import {observer} from 'mobx-react';
import React from 'react';
import Highlighter from 'react-highlight-words';

import {useAppContext} from '../../AppContext';
import {ITextEntryJsonApi} from '../../models/TextEntryModel';

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
export default React.memo(observer(EntrySubject));
