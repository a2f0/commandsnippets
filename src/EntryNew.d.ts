import React from 'react';
import {ITag} from './src/Entry';
export interface Props {
  tag: ITag;
  retrieveEntries: () => void;
  handleCancelNewEntry: () => void;
}

declare const EntryNew: React.SFC<Props>;

export default EntryNew;
