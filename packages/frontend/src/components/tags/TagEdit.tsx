import React from 'react';
import {useMounted} from '../../hooks/useMounted';
import {useSaveError} from '../../hooks/useSaveError';
import type {ITagJsonApi} from '../../lib/api/responses/types';
import {useSession} from '../../lib/data/hooks';
import {renameTag} from '../../lib/data/writes';
import {TagForm} from './TagForm';

interface ITagEdit {
  object: ITagJsonApi;
  /** After the rename is stored, with the renamed tag. */
  handleSaveParent: (renamed: ITagJsonApi) => void;
  handleCancelEditParent: () => void;
}

const TagEdit = ({
  handleSaveParent,
  handleCancelEditParent,
  object,
}: ITagEdit) => {
  const session = useSession();
  const mounted = useMounted();
  const saveError = useSaveError('update tag');

  const handleSave = (tagName: string) => {
    if (session === null) {
      return;
    }
    saveError.clear();
    renameTag(session, object.id, tagName)
      .then(renamed => {
        if (mounted.current && renamed !== null) {
          handleSaveParent(renamed);
        }
      })
      .catch(saveError.failed);
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
