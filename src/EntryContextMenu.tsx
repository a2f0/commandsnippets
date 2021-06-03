import React, {useEffect, useState} from 'react';
import API from './api';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';

import {IMouse, ITextEntry} from './Entry';

export interface IEntryContextMenu {
  mouse: IMouse;
  id: number;
  text_entry: ITextEntry;
  handleDelete: (id: number) => void;
  handleNewEntry: () => void;
  handleBeginEdit: () => void;
}

const EntryContextMenu = (props: IEntryContextMenu) => {
  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mouse, setMouse] = useState(initialMouse);

  useEffect(() => {
    setMouse(props.mouse);
  }, [props.mouse]);

  const handleClose = () => {
    setMouse(initialMouse);
  };

  const handleUntag = (id: number) => {
    API.delete('/tags_entries/' + id, {withCredentials: true});
    props.handleDelete(id);
    handleClose();
  };

  const handleBeginEdit = () => {
    props.handleBeginEdit();
    handleClose();
  };

  const handleNewEntry = () => {
    props.handleNewEntry();
    handleClose();
  };

  const handleIncrementTimesUsed = () => {
    const entry_reuse_payload = {
      data: {
        type: 'TextEntryReused',
        attributes: {},
        relationships: {
          text_entry: {
            data: {
              type: 'TextEntry',
              id: props.text_entry.id,
            },
          },
        },
      },
    };
    API.post('/entry_reuses', entry_reuse_payload, {withCredentials: true})
      .then(() => {})
      .catch(error => {
        // handle error
        console.log(error);
      })
      .then(() => {
        // always executed
        handleClose();
      });
  };

  return (
    <Menu
      keepMounted
      open={mouse.mouseY !== null}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={
        mouse.mouseY !== null && mouse.mouseX !== null
          ? {top: mouse.mouseY, left: mouse.mouseX}
          : undefined
      }
    >
      <MenuItem
        onClick={() => {
          handleBeginEdit();
        }}
      >
        Edit
      </MenuItem>
      <MenuItem
        onClick={() => {
          handleNewEntry();
        }}
      >
        New Entry
      </MenuItem>
      <MenuItem
        onClick={() => {
          handleIncrementTimesUsed();
        }}
      >
        Increment Times Used
      </MenuItem>
      <MenuItem
        onClick={() => {
          handleUntag(props.id);
        }}
      >
        Untag
      </MenuItem>
    </Menu>
  );
};
export default React.memo(EntryContextMenu);
