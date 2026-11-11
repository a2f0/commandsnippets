import React from 'react';
import {useMounted} from '../../hooks/useMounted';
import {useSaveError} from '../../hooks/useSaveError';
import {useSession} from '../../lib/data/hooks';
import {createEntry} from '../../lib/data/writes';
import {useAppConfig} from '../../lib/state/appState';
import {EntryForm} from './EntryForm';

interface IEntryNewProps {
  id: string;
  /** The tag the entry goes in (none: untagged). */
  tagId: string | undefined;
}

const EntryNew = ({id, tagId}: IEntryNewProps) => {
  const appConfig = useAppConfig();
  const session = useSession();
  const mounted = useMounted();
  const saveError = useSaveError('create entry');

  const handleSave = (subject: string, body: string) => {
    if (session === null) return;
    void saveError.save(
      () => createEntry(session, subject, body, tagId),
      () => {
        if (mounted.current) appConfig.setEntryNew(null);
      }
    );
  };

  const handleCancel = () => {
    appConfig.setEntryNew(null);
  };

  return (
    <EntryForm
      id={id}
      kind="new"
      subject=""
      body=""
      onSave={handleSave}
      onCancel={handleCancel}
      error={saveError.error}
      saving={saveError.saving}
    />
  );
};

const memoizedEntryNew = React.memo(EntryNew);

export {memoizedEntryNew as EntryNew};
