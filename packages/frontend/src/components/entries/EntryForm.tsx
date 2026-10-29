import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {useTheme} from '@mui/material/styles';
import {useEffect, useRef, useState} from 'react';
import {
  entryEditFields,
  useEditFieldCycle,
} from '../../hooks/useEditFieldCycle';
import {useTypedTranslation} from '../../i18n/hooks';
import {needsScrollingIntoView} from '../../lib/scroll';
import {activeEntryEditField, appMode} from '../../lib/shared';
import {useAppConfig} from '../../lib/state/appState';
import {commonButtonSx} from '../../theme/sx';
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
}

/** The subject, body, Save and Cancel of the entry editors. */
export const EntryForm = ({
  id,
  kind,
  subject: initialSubject,
  body: initialBody,
  onSave,
  onCancel,
}: IEntryFormProps) => {
  const {t} = useTypedTranslation('common');
  const [subject, setSubject] = useState<string>(initialSubject);
  const [body, setBody] = useState<string>(initialBody);
  const appConfig = useAppConfig();
  const saveRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const theme = useTheme();

  useEffect(() => {
    return () => {
      appConfig.setActiveEntryEditField(activeEntryEditField.subject);
      appConfig.setAppMode(appMode.entriesList);
    };
  }, [appConfig]);

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

  useEditFieldCycle(entryEditFields, {save: saveRef, cancel: cancelRef});

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
          ...commonButtonSx,
        }
      : commonButtonSx;
  const color = kind === 'edit' ? 'primary' : 'secondary';

  return (
    <Box
      id={id}
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
        />
      </div>
      <div>
        <InputEntryBody
          id={`${id}Body`}
          placeholder="body"
          valueParent={body}
          handleChangeParent={setBody}
        />
      </div>
      <Button
        ref={saveRef}
        id={`${id}Save`}
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
        ref={cancelRef}
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
