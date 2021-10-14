import React, {useEffect, useState} from 'react';
import API from './api';
import {IMouse} from './Entry';
import {ITextEntryJsonApi} from './models/TextEntryModel';
import Menu from '@material-ui/core/Menu';
import StyledMenuItem from './StyledMenuItem';
import {useAppContext} from './AppContext';
import {useParams} from 'react-router-dom';

interface IParamTypes {
  user: string;
  tag: string;
}

export interface IEntryContextMenu {
  mouse: IMouse;
  id: string;
  text_entry: ITextEntryJsonApi;
  handleDeleteParent: (id: string) => void;
  handleNewEntryParent: () => void;
  handleBeginEditParent: () => void;
  handleCopyParent: () => void;
}

const EntryContextMenu = ({
  mouse,
  id,
  text_entry,
  handleDeleteParent,
  handleNewEntryParent,
  handleBeginEditParent,
  handleCopyParent,
}: IEntryContextMenu) => {
  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mousePosition, setMousePosition] = useState(initialMouse);
  const appConfig = useAppContext();
  const {user} = useParams<IParamTypes>();
  const {tag} = useParams<IParamTypes>();

  useEffect(() => {
    setMousePosition(mouse);
  }, [mouse]);

  const handleClose = () => {
    setMousePosition(initialMouse);
  };

  const handleUntag = (id: string) => {
    const userObject = appConfig.usersArray.find(
      element => element.attributes.username === user
    );

    const tagObject = appConfig.tagsArray.find(
      element =>
        element.attributes.name === tag &&
        element.relationships.user.data.id === userObject?.id
    );

    const tagTextEntryThroughModelObject =
      appConfig.tagTextEntryThroughModel.find(
        element =>
          element.relationships.tag.data.id === tagObject?.id &&
          element.relationships.text_entry.data.id === text_entry.id
      );
    API.delete('/tags_entries/' + tagTextEntryThroughModelObject?.id, {
      withCredentials: true,
    }).then(() => {
      tagTextEntryThroughModelObject?.remove();
    });
    handleDeleteParent(id);
    handleClose();
  };

  const handleBeginEdit = () => {
    handleBeginEditParent();
    handleClose();
  };

  const handleNewEntry = () => {
    handleNewEntryParent();
    handleClose();
  };

  const handleCopy = () => {
    handleCopyParent();
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
              id: text_entry.id,
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
      id={`tagsEntriesContextMenu-${id}`}
      keepMounted
      open={mousePosition.mouseY !== null}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={
        mousePosition.mouseY !== null && mousePosition.mouseX !== null
          ? {top: mousePosition.mouseY, left: mousePosition.mouseX}
          : undefined
      }
    >
      <StyledMenuItem
        onClick={() => {
          handleCopy();
        }}
      >
        Copy
      </StyledMenuItem>
      <StyledMenuItem
        onClick={() => {
          handleBeginEdit();
        }}
      >
        Edit
      </StyledMenuItem>
      <StyledMenuItem
        onClick={() => {
          handleNewEntry();
        }}
      >
        New Entry
      </StyledMenuItem>
      <StyledMenuItem
        onClick={() => {
          handleIncrementTimesUsed();
        }}
      >
        Increment Times Used
      </StyledMenuItem>
      <StyledMenuItem
        onClick={() => {
          handleUntag(id);
        }}
      >
        Untag
      </StyledMenuItem>
    </Menu>
  );
};
export default React.memo(EntryContextMenu);
