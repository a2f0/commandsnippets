import React from 'react';
import {StyledMenuItem} from './StyledMenuItem';

interface DialogProps {
  dialogOpen: boolean;
  closeDialog: () => void;
}

interface IProps {
  id: string;
  label: string;
  /** Closes the menu. */
  onClose: () => void;
  /** What the item opens, as the menu closes. */
  Dialog: React.ComponentType<DialogProps>;
}

/** A menu item that opens a dialog (Help > About, Debug > Feature Flags). */
const DialogMenuItem = ({id, label, onClose, Dialog}: IProps) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const closeDialog = React.useCallback(() => setDialogOpen(false), []);

  return (
    <>
      <StyledMenuItem
        id={id}
        onClick={() => {
          setDialogOpen(true);
          onClose();
        }}
      >
        {label}
      </StyledMenuItem>
      <Dialog dialogOpen={dialogOpen} closeDialog={closeDialog} />
    </>
  );
};

const memoizedDialogMenuItem = React.memo(DialogMenuItem);

export {memoizedDialogMenuItem as DialogMenuItem};
