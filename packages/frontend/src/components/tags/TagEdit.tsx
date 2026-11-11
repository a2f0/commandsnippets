import React from 'react';
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

  const handleSave = (tagName: string) => {
    if (session === null) return;
    const generation = sessionsEndedCount();
    const path = currentPath();
    const sameSession = () =>
      generation === sessionsEndedCount() &&
      useAppState.getState().loggedInUser === session.username;
    void saveError.save(
      async () => {
        const identity = await captureTagRenameIdentity(session);
        const renamed = await renameTag(session, object.id, tagName, identity);
        return {identity, renamed};
      },
      async ({identity, renamed}) => {
        if (renamed === null) return;
        try {
          // Close this editor before the optional route follow-up.
          if (mounted.current) handleSaveParent();
          if (!sameSession()) return;
          const current = await isCurrentTagRename(session, renamed, identity);
          if (current && sameSession() && currentPath() === path) {
            handleStoredParent(renamed);
          }
        } catch (error) {
          // Persistence succeeded; a callback failure must not report it unsaved.
          console.error('Failed to finish the saved tag rename:', error);
        }
      }
    );
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
      saving={saveError.saving}
    />
  );
};

const memoizedTagEdit = React.memo(TagEdit);

export {memoizedTagEdit as TagEdit};
