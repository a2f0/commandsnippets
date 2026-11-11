import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {useTheme} from '@mui/material/styles';
import {useEffect, useRef, useState} from 'react';
import {useEditFieldCycle} from '../../hooks/useEditFieldCycle';
import {useEditorOwnership} from '../../hooks/useEditorOwnership';
import {useTypedTranslation} from '../../i18n/hooks';
import {needsScrollingIntoView} from '../../lib/scroll';
import {appMode} from '../../lib/shared';
import {InputEntryBody} from './InputEntryBody';
import {InputEntrySubject} from './InputEntrySubject';

export interface IEntryFormProps {
  id: string;
  /**
   * `edit`: an entry's editor, in place of its row (`EntryEdit`), which
   * opens with its Save button in view. `new`: a new entry's form
   * (`EntryNew`), with buttons of the secondary color.
   */
  kind: 'edit' | 'new';
  /** What the fields open with, and go back to on Cancel. */
  subject: string;
  body: string;
  /** Save what the fields hold. */
  onSave: (subject: string, body: string) => void;
  onCancel: () => void;
  /** Why the last save failed (none: it did not). */
  error?: string | null;
  /** Freeze the submitted draft until its save finishes; Cancel stays available. */
  saving?: boolean;
}

/** The subject, body, Save and Cancel of the entry editors. */
export const EntryForm = ({
  id,
  kind,
  subject: initialSubject,
  body: initialBody,
  onSave,
  onCancel,
  error = null,
  saving = false,
}: IEntryFormProps) => {
  const {t} = useTypedTranslation('common');
  const [subject, setSubject] = useState<string>(initialSubject);
  const [body, setBody] = useState<string>(initialBody);
  const owner = useEditorOwnership(appMode.entryEditor, true);
  const saveRef = useRef<HTMLButtonElement>(null);
  const theme = useTheme();

  // An entry's editor opens with its Save button in view (above the footer).
  useEffect(() => {
    if (
      kind === 'edit' &&
      saveRef.current &&
      needsScrollingIntoView(saveRef, theme)
    ) {
      saveRef.current.scrollIntoView({
        behavior: 'auto',
        block: 'end',
      });
    }
  }, [kind, theme]);

  useEditFieldCycle(owner);

  const handleCancel = () => {
    setBody(initialBody);
    setSubject(initialSubject);
    onCancel();
  };

  const buttonSx =
    kind === 'edit'
      ? {
          // Scrolled into view clear of the footer, which covers the bottom
          // of the window: Save as the editor opens, either button when
          // focused.
          scrollMarginBottom: `${theme.footer.height + 10}px`,
          marginBottom: '10px',
        }
      : {};
  const color = kind === 'edit' ? 'primary' : 'secondary';

  return (
    <Box
      id={id}
      ref={owner.ref}
      onFocusCapture={owner.onFocusCapture}
      sx={{
        ml: theme => `${theme.main.dragIndicatorWidth}px`,
      }}
    >
      <div>
        <InputEntrySubject
          id={`${id}Subject`}
          placeholder="subject"
          valueParent={subject}
          handleChangeParent={setSubject}
          readOnly={saving}
        />
      </div>
      <div>
        <InputEntryBody
          id={`${id}Body`}
          placeholder="body"
          valueParent={body}
          handleChangeParent={setBody}
          readOnly={saving}
        />
      </div>
      {error !== null && (
        <Alert id={`${id}Error`} severity="error" sx={{mb: '4px'}}>
          {error}
        </Alert>
      )}
      <Button
        ref={saveRef}
        id={`${id}Save`}
        disabled={saving}
        aria-busy={saving}
        color={color}
        sx={{
          ...buttonSx,
          marginRight: '2px',
        }}
        size="small"
        variant="outlined"
        onClick={() => {
          onSave(subject, body);
        }}
      >
        {t('save')}
      </Button>
      <Button
        id={`${id}Cancel`}
        color={color}
        size="small"
        variant="outlined"
        onClick={handleCancel}
        sx={buttonSx}
      >
        {t('cancel')}
      </Button>
    </Box>
  );
};
