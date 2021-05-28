import React from 'react';
import {IMouse} from './Entry';
import {ITag, IMouse, ITextEntry} from './src/Entry';
export interface Props {
  mouse: IMouse;
  id: number;
  text_entry: ITextEntry;
  handleDelete: (id: number) => void;
  handleNewEntry: () => void;
  handleBeginEdit: () => void;
}

declare const EntryContextMenu: React.SFC<Props>;

export default EntryContextMenu;
