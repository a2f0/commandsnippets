import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import type React from 'react';

interface IProps {
  /** The dialog's id; its title is `<id>Title` and its text `<id>Text`. */
  id: string;
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  text?: React.ReactNode;
  /** Its buttons. */
  actions: React.ReactNode;
}

/** A dialog of a title, an optional line of text and buttons. */
export const SimpleDialog = ({
  id,
  open,
  onClose,
  title,
  text,
  actions,
}: IProps) => (
  <Dialog
    id={id}
    open={open}
    onClose={onClose}
    aria-labelledby={`${id}Title`}
    aria-describedby={text === undefined ? undefined : `${id}Text`}
  >
    <DialogTitle id={`${id}Title`}>{title}</DialogTitle>
    {text !== undefined && (
      <DialogContent>
        <DialogContentText id={`${id}Text`}>{text}</DialogContentText>
      </DialogContent>
    )}
    <DialogActions>{actions}</DialogActions>
  </Dialog>
);
