import React from 'react';
import {useMounted} from '../../hooks/useMounted';
import {useSaveError} from '../../hooks/useSaveError';
import type {ITextEntryJsonApi} from '../../lib/api/responses/types';
import {useSession} from '../../lib/data/hooks';
import {updateEntry} from '../../lib/data/writes';
import {EntryForm} from './EntryForm';

interface IEntryEdit {
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
  const mounted = useMounted();
  const saveError = useSaveError('update entry');

  const handleSave = (subject: string, body: string) => {
    if (session === null) return;
    void saveError.save(
      () => updateEntry(session, object.id, subject, body),
      () => {
        if (mounted.current) handleSaveParent();
      }
    );
  };

  return (
    <EntryForm
      id={id}
      kind="edit"
      subject={object.attributes.subject}
      body={object.attributes.body}
      onSave={handleSave}
      onCancel={handleCancelEditParent}
      error={saveError.error}
      saving={saveError.saving}
    />
  );
};

const memoizedEntryEdit = React.memo(EntryEdit);

export {memoizedEntryEdit as EntryEdit};
