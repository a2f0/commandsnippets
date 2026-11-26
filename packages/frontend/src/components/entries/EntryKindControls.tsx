import type {EntryKind} from '@commandsnippets/api-shared/responses';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import type {SxProps, Theme} from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import {useTypedTranslation} from '../../i18n/hooks';
import {useAppState} from '../../lib/state/appState';
import {KeySequence} from './KeySequence';

interface IEntryKindCheckboxProps {
  /** The form's id: the checkbox is `${id}Shortcut`. */
  id: string;
  entryKind: EntryKind;
  onChange: (entryKind: EntryKind) => void;
  disabled: boolean;
  sx: SxProps<Theme>;
}

/** Whether the entry is a keyboard shortcut, beside the form's buttons. */
export const EntryKindCheckbox = ({
  id,
  entryKind,
  onChange,
  disabled,
  sx,
}: IEntryKindCheckboxProps) => {
  const {t} = useTypedTranslation('entries');
  return (
    <FormControlLabel
      sx={sx}
      control={
        <Checkbox
          id={`${id}Shortcut`}
          size="small"
          color="default"
          checked={entryKind === 'shortcut'}
          disabled={disabled}
          onChange={event =>
            onChange(event.target.checked ? 'shortcut' : 'snippet')
          }
        />
      }
      label={t('shortcutKind')}
      slotProps={{typography: {variant: 'body2'}}}
    />
  );
};

/** A shortcut's keys as they are typed, under its body (`${id}KeysPreview`). */
export const KeysPreview = ({id, body}: {id: string; body: string}) =>
  body.trim() === '' ? null : (
    <Box id={`${id}KeysPreview`} sx={{mb: '4px', fontSize: '13.333px'}}>
      <KeySequence body={body} />
    </Box>
  );

/**
 * Under an entry list that shows nothing while View shows one kind: that
 * the kind hides the rest, rather than an empty list.
 */
export const NoneOfKindShown = ({shown}: {shown: number | undefined}) => {
  const {t} = useTypedTranslation('entries');
  const kindFilter = useAppState(state => state.entryKindFilter);
  if (kindFilter === 'all' || shown !== 0) return null;
  return (
    <Typography
      id="entriesNoneOfKind"
      variant="body2"
      color="text.secondary"
      sx={{ml: theme => `${theme.main.dragIndicatorWidth}px`, py: '8px'}}
    >
      {kindFilter === 'shortcut' ? t('noShortcutsShown') : t('noSnippetsShown')}
    </Typography>
  );
};
