import React from 'react';
import type {ITagJsonApi} from '../../lib/api/responses/types';
import {useSession} from '../../lib/data/hooks';
import {renameTag} from '../../lib/data/writes';
import {TagForm} from './TagForm';

export interface ITagEdit {
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

  const handleSave = (tagName: string) => {
    if (session === null) {
      return;
    }
    renameTag(session, object.id, tagName)
      .then(renamed => {
        if (renamed !== null) {
          handleSaveParent(renamed);
        }
      })
      .catch((error: unknown) => {
        console.error('Unexpected error updating tag:', error);
      });
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
    />
  );
};

const memoizedTagEdit = React.memo(TagEdit);

export {memoizedTagEdit as TagEdit};
