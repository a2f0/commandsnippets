import React from 'react';
import {ITag} from './src/Entry';

export interface Props {
  subject: string;
  body: string;
  handleSave: (updated_subject: string, updated_body: string) => void;
  handleCancelEdit: () => void;
}

declare const EntryNew: React.SFC<Props>;

export default EntryNew;
