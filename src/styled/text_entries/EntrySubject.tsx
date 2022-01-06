import Highlighter from 'react-highlight-words';
import {ITextEntryJsonApi} from '../../models/TextEntryModel';
import React from 'react';
import {observer} from 'mobx-react';
import {useAppContext} from '../../AppContext';

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
