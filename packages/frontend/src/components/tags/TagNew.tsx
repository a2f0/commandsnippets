import React, {useEffect, useRef} from 'react';
import {tagEditFields, useEditFieldCycle} from '../../hooks/useEditFieldCycle';
import {useMounted} from '../../hooks/useMounted';
import {useSaveError} from '../../hooks/useSaveError';
import {useSession} from '../../lib/data/hooks';
import {createTag} from '../../lib/data/writes';
import {activeTagEditField} from '../../lib/shared';
import {useAppConfig} from '../../lib/state/appState';
import {TagForm} from './TagForm';

interface IProps {
  id: string;
}

const TagNew = ({id}: IProps) => {
  const session = useSession();
  const mounted = useMounted();
  const appConfig = useAppConfig();
  const inputSaveRef = useRef<HTMLButtonElement>(null);
  const inputCancelRef = useRef<HTMLButtonElement>(null);
  const inputTagNameRef = useRef<HTMLInputElement>(null);
  const saveError = useSaveError('create tag');

  useEditFieldCycle(tagEditFields, {
    save: inputSaveRef,
    cancel: inputCancelRef,
  });

  useEffect(() => {
    if (appConfig.activeTagEditField === activeTagEditField.name) {
      inputTagNameRef.current?.focus();
    }
  }, [appConfig.activeTagEditField]);

  // Closing leaves the name active for the next form. Only on close: a reset
  // whenever the active field changed sent Tab straight back to the name.
  useEffect(
    () => () => {
      appConfig.setActiveTagEditField(activeTagEditField.name);
    },
    []
  );

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
      nameRef={inputTagNameRef}
      saveRef={inputSaveRef}
      cancelRef={inputCancelRef}
    />
  );
};

const memoizedTagNew = React.memo(TagNew);

export {memoizedTagNew as TagNew};
