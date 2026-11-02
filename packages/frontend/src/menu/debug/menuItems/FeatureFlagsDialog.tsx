import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Switch,
} from '@mui/material';
import React from 'react';

import {type MenuKeys, useTypedTranslation} from '../../../i18n/hooks';
import {
  featureFlagDefault,
  featureFlagOverride,
  resetFeatureFlagOverrides,
  setFeatureFlagOverride,
  useFeatureFlagStore,
} from '../../../lib/featureFlags/featureFlags';
import {
  FEATURE_FLAG_NAMES,
  type FeatureFlag,
} from '../../../lib/featureFlags/flags';

/** Each flag's name in the menu translations. */
const featureFlagNameKeys: Readonly<Record<FeatureFlag, MenuKeys>> = {
  hud: 'featureFlagHud',
  languageSwitcher: 'featureFlagLanguageSwitcher',
  userProfileMenu: 'featureFlagUserProfileMenu',
};

interface IProps {
  dialogOpen: boolean;
  closeDialog: () => void;
}

/**
 * Every feature flag with a switch that overrides it on this device, what it
 * is by default here, and a reset of every override.
 */
const FeatureFlagsDialog = ({dialogOpen, closeDialog}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const overrides = useFeatureFlagStore(state => state.overrides);

  return (
    <Dialog
      id="DebugFeatureFlagsDialog"
      fullWidth={true}
      maxWidth="sm"
      open={dialogOpen}
      onClose={closeDialog}
      aria-labelledby="feature-flags-dialog-title"
    >
      <DialogTitle id="feature-flags-dialog-title">
        {t('featureFlagsDialogTitle')}
      </DialogTitle>
      <DialogContent>
        <List dense>
          {FEATURE_FLAG_NAMES.map(flag => {
            const byDefault = featureFlagDefault(flag);
            const override = featureFlagOverride(flag, overrides);
            const enabled = override ?? byDefault;
            return (
              <ListItem key={flag} disableGutters>
                <ListItemText
                  primary={t(featureFlagNameKeys[flag])}
                  secondary={
                    override === undefined
                      ? t('featureFlagDefault', {
                          state: byDefault ? t('on') : t('off'),
                        })
                      : t('featureFlagOverridden', {
                          state: byDefault ? t('on') : t('off'),
                        })
                  }
                />
                <FormControlLabel
                  label={enabled ? t('on') : t('off')}
                  labelPlacement="start"
                  control={
                    <Switch
                      checked={enabled}
                      slotProps={{
                        input: {
                          'aria-label': t(featureFlagNameKeys[flag]),
                        },
                      }}
                      onChange={event => {
                        const next = event.target.checked;
                        // Back on the default, there is nothing to override.
                        setFeatureFlagOverride(
                          flag,
                          next === byDefault ? null : next
                        );
                      }}
                    />
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button
          color="secondary"
          variant="outlined"
          onClick={resetFeatureFlagOverrides}
          disabled={Object.keys(overrides).length === 0}
        >
          {t('resetFeatureFlags')}
        </Button>
        <Button
          color="secondary"
          variant="outlined"
          onClick={closeDialog}
          autoFocus
        >
          {t('close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const memoizedFeatureFlagsDialog = React.memo(FeatureFlagsDialog);

export {memoizedFeatureFlagsDialog as FeatureFlagsDialog};
