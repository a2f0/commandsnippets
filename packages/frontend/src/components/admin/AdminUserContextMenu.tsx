import {Menu} from '@mui/material';
import React from 'react';

import {useTypedTranslation} from '../../i18n/hooks';
import type {AdminUser} from '../../lib/api/adminApi';
import type {IMouse} from '../../lib/shared';
import {StyledMenuItem} from '../../menu/StyledMenuItem';

/** A change to the account, which staff confirm first. */
export type AdminUserChange =
  | 'deactivate'
  | 'reactivate'
  | 'markForDeletion'
  | 'unmarkForDeletion';

/** A change, or reading the user's data (read-only, on their page). */
export type AdminUserAction = 'viewData' | AdminUserChange;

const MENU_ITEM_IDS: Record<AdminUserAction, string> = {
  viewData: 'adminUserMenuViewData',
  deactivate: 'adminUserMenuDeactivate',
  reactivate: 'adminUserMenuReactivate',
  markForDeletion: 'adminUserMenuMarkForDeletion',
  unmarkForDeletion: 'adminUserMenuUnmarkForDeletion',
};

/**
 * What staff can do with `user`: read their data, and change the account.
 * An account marked for deletion stays deactivated, so it can only be
 * unmarked.
 */
function actionsFor(user: AdminUser): AdminUserAction[] {
  if (user.dateMarkedForDeletion !== null) {
    return ['viewData', 'unmarkForDeletion'];
  }
  return [
    'viewData',
    user.isActive ? 'deactivate' : 'reactivate',
    'markForDeletion',
  ];
}

interface IProps {
  /** The user the menu is for; kept while it closes, so its items stay. */
  user: AdminUser | null;
  /** Where it opens; `initialMouse` closes it. */
  mouse: IMouse;
  onClose: () => void;
  onAction: (user: AdminUser, action: AdminUserAction) => void;
}

/** A row's menu on the admin users table: its ⋮ button, or a right-click. */
const AdminUserContextMenu = ({user, mouse, onClose, onAction}: IProps) => {
  const {t} = useTypedTranslation('admin');

  return (
    <Menu
      id="adminUserMenu"
      open={user !== null && mouse.mouseY !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        mouse.mouseY !== null && mouse.mouseX !== null
          ? {top: mouse.mouseY, left: mouse.mouseX}
          : {top: 0, left: 0}
      }
    >
      {user !== null &&
        actionsFor(user).map(action => (
          <StyledMenuItem
            key={action}
            id={MENU_ITEM_IDS[action]}
            onClick={() => {
              onClose();
              onAction(user, action);
            }}
          >
            {t(action)}
          </StyledMenuItem>
        ))}
    </Menu>
  );
};

const memoizedAdminUserContextMenu = React.memo(AdminUserContextMenu);

export {memoizedAdminUserContextMenu as AdminUserContextMenu};
