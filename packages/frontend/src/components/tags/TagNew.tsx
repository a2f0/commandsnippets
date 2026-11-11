import React from 'react';
import {useMounted} from '../../hooks/useMounted';
import {useSaveError} from '../../hooks/useSaveError';
import {useSession} from '../../lib/data/hooks';
import {createTag} from '../../lib/data/writes';
import {useAppConfig} from '../../lib/state/appState';
import {TagForm} from './TagForm';

interface IProps {
  id: string;
}

const TagNew = ({id}: IProps) => {
  const session = useSession();
  const mounted = useMounted();
  const appConfig = useAppConfig();
  const saveError = useSaveError('create tag');

  const handleCancel = () => {
    appConfig.setTagNew(null);
  };

  const handleSave = (tagName: string) => {
    if (session === null) {
      return;
    }
    saveError.clear();
    createTag(session, tagName)
      .then(() => {
        if (mounted.current) appConfig.setTagNew(null);
      })
      .catch(saveError.failed);
  };

  return (
    <TagForm
      ids={{
        form: id,
        name: `${id}TextField`,
        save: `${id}Save`,
        cancel: `${id}Cancel`,
      }}
      name=""
      onSave={handleSave}
      onCancel={handleCancel}
      error={saveError.error}
      cycleFields
    />
  );
};

const memoizedTagNew = React.memo(TagNew);

export {memoizedTagNew as TagNew};
