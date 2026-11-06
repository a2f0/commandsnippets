import React, {useRef} from 'react';
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
  // One save at a time: another click (or Enter) before the entry is stored
  // and the form closes would store a second entry.
  const saving = useRef(false);

  const handleSave = (subject: string, body: string) => {
    if (session === null || saving.current) {
      return;
    }
    saving.current = true;
    createEntry(session, subject, body, tagId)
      .then(() => {
        appConfig.setEntryNew(null);
      })
      .catch((error: unknown) => {
        console.error('Failed to create entry:', error);
      })
      .finally(() => {
        saving.current = false;
      });
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
    />
  );
};

const memoizedEntryNew = React.memo(EntryNew);

export {memoizedEntryNew as EntryNew};
