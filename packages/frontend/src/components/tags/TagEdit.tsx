import React, {useRef} from 'react';
import {useMounted} from '../../hooks/useMounted';
import {useSaveError} from '../../hooks/useSaveError';
import type {ITagJsonApi} from '../../lib/api/responses/types';
import {useSession} from '../../lib/data/hooks';
import {
  captureTagRenameIdentity,
  isCurrentTagRename,
} from '../../lib/data/tagRename';
import {renameTag} from '../../lib/data/writes';
import {currentPath} from '../../lib/router/navigation';
import {useAppState} from '../../lib/state/appState';
import {sessionsEndedCount} from '../../lib/sync/session';
import {TagForm} from './TagForm';

interface ITagEdit {
  object: ITagJsonApi;
  /** Close this editor after its rename is stored, never a replacement. */
  handleSaveParent: () => void;
  /** Follow the stored rename even if the editor was closed meanwhile. */
  handleStoredParent: (renamed: ITagJsonApi) => void;
  handleCancelEditParent: () => void;
}

const TagEdit = ({
  handleSaveParent,
  handleStoredParent,
  handleCancelEditParent,
  object,
}: ITagEdit) => {
  const session = useSession();
  const mounted = useMounted();
  const saveError = useSaveError('update tag');
  const saving = useRef(false);

  const handleSave = async (tagName: string) => {
    if (session === null || saving.current) {
      return;
    }
    saving.current = true;
    saveError.clear();
    const generation = sessionsEndedCount();
    const path = currentPath();
    const sameSession = () =>
      generation === sessionsEndedCount() &&
      useAppState.getState().loggedInUser === session.username;
    try {
      const identity = await captureTagRenameIdentity(session);
      const renamed = await renameTag(session, object.id, tagName, identity);
      if (renamed === null) return;
      // Closing belongs to the saved editor, not the optional route follow-up.
      if (mounted.current) {
        handleSaveParent();
      }
      if (!sameSession()) return;
      const current = await isCurrentTagRename(session, renamed, identity);
      if (current && sameSession() && currentPath() === path) {
        handleStoredParent(renamed);
      }
    } catch (error) {
      saveError.failed(error);
    } finally {
      saving.current = false;
    }
  };

  return (
    <TagForm
      ids={{
        form: `tagEdit${object.id}`,
        name: `tagEditTagName${object.id}`,
        save: `tagEditSave${object.id}`,
        cancel: `tagEditCancel${object.id}`,
      }}
      name={object.attributes.name}
      onSave={handleSave}
      onCancel={handleCancelEditParent}
      error={saveError.error}
    />
  );
};

const memoizedTagEdit = React.memo(TagEdit);

export {memoizedTagEdit as TagEdit};
