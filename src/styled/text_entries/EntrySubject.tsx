import {ITextEntryJsonApi} from '../../models/TextEntryModel';
import React from 'react';
import {observer} from 'mobx-react';

export interface IProps {
  object: ITextEntryJsonApi;
}

const style = {
  fontSize: 14,
};

const EntrySubject = ({object}: IProps) => {
  return <div style={style}>{object.attributes.subject}</div>;
};
export default React.memo(observer(EntrySubject));
