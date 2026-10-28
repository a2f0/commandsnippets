import React from 'react';
import type {ITextEntryJsonApi} from '../../lib/api/responses/types';
import {useSession} from '../../lib/data/hooks';
import {updateEntry} from '../../lib/data/writes';
import {EntryForm} from './EntryForm';

export interface IEntryEdit {
  object: ITextEntryJsonApi;
  /** After the edit is stored. */
  handleSaveParent: () => void;
  handleCancelEditParent: () => void;
  id: string;
}

const EntryEdit = ({
  object,
  handleSaveParent,
  handleCancelEditParent,
  id,
}: IEntryEdit) => {
  const session = useSession();

  const handleSave = (subject: string, body: string) => {
    if (session === null) {
      return;
    }
    updateEntry(session, object.id, subject, body)
      .then(() => handleSaveParent())
      .catch((error: unknown) => {
        console.error('Failed to update entry:', error);
      });
  };

  return (
    <EntryForm
      id={id}
      kind="edit"
      subject={object.attributes.subject}
      body={object.attributes.body}
      onSave={handleSave}
      onCancel={handleCancelEditParent}
    />
  );
};

const memoizedEntryEdit = React.memo(EntryEdit);

export {memoizedEntryEdit as EntryEdit};
