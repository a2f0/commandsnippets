import {Box, TextField, ToggleButton, ToggleButtonGroup} from '@mui/material';
import {useTypedTranslation} from '../../i18n/hooks';
import type {AdminUserStatus} from '../../lib/api/adminApi';

interface IProps {
  search: string;
  onSearchChange: (search: string) => void;
  status: AdminUserStatus;
  onStatusChange: (status: AdminUserStatus) => void;
}

/** The users table's search field and status filter. */
export const AdminUsersToolbar = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
}: IProps) => {
  const {t} = useTypedTranslation('admin');
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        alignItems: 'center',
        mb: 2,
      }}
    >
      <TextField
        id="adminUserSearch"
        label={t('searchLabel')}
        type="search"
        size="small"
        value={search}
        onChange={event => onSearchChange(event.target.value)}
        sx={{minWidth: 280}}
      />
      <ToggleButtonGroup
        id="adminStatusFilter"
        aria-label={t('statusLabel')}
        size="small"
        exclusive
        value={status}
        onChange={(_event, value: AdminUserStatus | null) => {
          if (value !== null) {
            onStatusChange(value);
          }
        }}
      >
        <ToggleButton value="all">{t('statusAll')}</ToggleButton>
        <ToggleButton value="active">{t('statusActive')}</ToggleButton>
        <ToggleButton value="inactive">{t('statusInactive')}</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
};
