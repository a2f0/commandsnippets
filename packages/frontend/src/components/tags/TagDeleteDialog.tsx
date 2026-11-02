import {Button} from '@mui/material';
import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import {SimpleDialog} from '../SimpleDialog';

interface ITagDeleteDialog {
  id: string;
  open: boolean;
  handleCancelDialog: () => void;
  handleAcceptDialog: () => void;
}

const TagDeleteDialog = ({
  id,
  open,
  handleCancelDialog,
  handleAcceptDialog,
}: ITagDeleteDialog) => {
  const {t: tTags} = useTypedTranslation('tags');
  const {t: tCommon} = useTypedTranslation('common');

  return (
    <SimpleDialog
      id={`tagContextMenu${id}DeleteTagDialog`}
      open={open}
      onClose={handleCancelDialog}
      title={tTags('confirmDeleteTag')}
      actions={
        <>
          <Button
            id={`tagContextMenu${id}DeleteTagDialogCancelButton`}
            variant="outlined"
            onClick={handleCancelDialog}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            id={`tagContextMenu${id}DeleteTagDialogDeleteButton`}
            variant="outlined"
            onClick={handleAcceptDialog}
            autoFocus
          >
            {tCommon('delete')}
          </Button>
        </>
      }
    />
  );
};

const memoizedTagDeleteDialog = React.memo(TagDeleteDialog);

export {memoizedTagDeleteDialog as TagDeleteDialog};
