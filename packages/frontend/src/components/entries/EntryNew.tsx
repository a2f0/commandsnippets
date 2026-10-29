import React from 'react';
import {useSession} from '../../lib/data/hooks';
import {createEntry} from '../../lib/data/writes';
import {useAppConfig} from '../../lib/state/appState';
import {EntryForm} from './EntryForm';

export interface IEntryNewProps {
  id: string;
  /** The tag the entry goes in (none: untagged). */
  tagId: string | undefined;
}

const EntryNew = ({id, tagId}: IEntryNewProps) => {
  const appConfig = useAppConfig();
  const session = useSession();

  const handleSave = (subject: string, body: string) => {
    if (session === null) {
      return;
    }
    createEntry(session, subject, body, tagId)
      .then(() => {
        appConfig.setEntryNew(null);
      })
      .catch((error: unknown) => {
        console.error('Failed to create entry:', error);
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
