import type {EntryKind} from '@commandsnippets/api-shared/responses';
import React from 'react';
import {useMounted} from '../../hooks/useMounted';
import {useSaveError} from '../../hooks/useSaveError';
import {useSession} from '../../lib/data/hooks';
import {createEntry} from '../../lib/data/writes';
import {useAppConfig, useAppState} from '../../lib/state/appState';
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
  // A shortcut while View shows only shortcuts, so the new entry stays shown.
  const kindFilter = useAppState(state => state.entryKindFilter);

  const handleSave = (subject: string, body: string, kind: EntryKind) => {
    if (session === null) return;
    void saveError.save(
      () => createEntry(session, subject, body, tagId, kind),
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
      entryKind={kindFilter === 'shortcut' ? 'shortcut' : 'snippet'}
      onSave={handleSave}
      onCancel={handleCancel}
      error={saveError.error}
      saving={saveError.saving}
    />
  );
};

const memoizedEntryNew = React.memo(EntryNew);

export {memoizedEntryNew as EntryNew};
