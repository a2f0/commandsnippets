import type {EntryKind} from '@commandsnippets/api-shared/responses';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import type {SxProps, Theme} from '@mui/material/styles';
import {useTypedTranslation} from '../../i18n/hooks';
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
