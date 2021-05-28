import * as React from 'react';
interface IEntry {
  id: number;
  index: number;
  type: string;
  relationships: {
    text_entry: ITextEntry;
  };
}
export interface ITag {
  id: number;
  type: string;
}
interface ITextEntry {
  id: number;
  type: string;
  attributes: {
    subject: string;
    body: string;
  };
  data: {
    id: number;
  };
}
export interface IMouse {
  mouseX: number | null;
  mouseY: number | null;
}
interface IEntryProps {
  id: number;
  index: number;
  moveEntry: (id: number, to: number) => void;
  findEntry: (id: number) => {
    entry: IEntry;
    index: number;
  };
  handleDelete: (id: number) => void;
  text_entry: ITextEntry;
  tag: ITag;
  retrieveEntries: () => void;
  findEntryByIndex: (id: number) => IEntry;
}
declare const Entry: React.FunctionComponent<IEntryProps>;
export default Entry;
