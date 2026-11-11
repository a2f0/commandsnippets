import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import {useState} from 'react';
import {useEditFieldCycle} from '../../hooks/useEditFieldCycle';
import {useEditorOwnership} from '../../hooks/useEditorOwnership';
import {appMode} from '../../lib/shared';
import {StyledTagButton} from './StyledTagButton';
import {StyledTagFormContainer} from './StyledTagFormContainer';
import {StyledTextFieldTags} from './StyledTextFieldTags';

interface ITagFormProps {
  /** The ids of the form, its name field and its buttons. */
  ids: {form: string; name: string; save: string; cancel: string};
  /** The name the field opens with. */
  name: string;
  /** Save the name the field holds. */
  onSave: (name: string) => void;
  /** Cancel, or Escape from this form while it owns the keyboard. */
  onCancel: () => void;
  /** New tags cycle name/Save/Cancel; renames retain native Tab. */
  cycleFields?: boolean;
  /** Why the last save failed (none: it did not). */
  error?: string | null;
  /** Freeze the submitted draft until its save finishes; Cancel stays available. */
  saving?: boolean;
}

/** The name field, Save and Cancel of a new tag's form and a tag's editor. */
export const TagForm = ({
  ids,
  name: initialName,
  onSave,
  onCancel,
  cycleFields = false,
  error = null,
  saving = false,
}: ITagFormProps) => {
  const owner = useEditorOwnership(appMode.tagEditor, true, saving);

  useEditFieldCycle(owner, cycleFields);
  const [name, setName] = useState<string>(initialName);

  return (
    <StyledTagFormContainer
      id={ids.form}
      ref={owner.ref}
      onFocusCapture={owner.onFocusCapture}
      onKeyDown={event => {
        if (
          event.code === 'Escape' &&
          !event.defaultPrevented &&
          owner.ownsKeyboard()
        ) {
          // Handle the focused form before document-level search shortcuts.
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <StyledTextFieldTags
        readOnly={saving}
        value={name}
        id={ids.name}
        onChange={event => {
          setName(event.target.value);
        }}
      />
      {error !== null && (
        <Alert id={`${ids.form}Error`} severity="error" sx={{mt: '4px'}}>
          {error}
        </Alert>
      )}
      <Grid container spacing={0}>
        <Grid sx={{paddingRight: '1px'}} size={{xs: 6}}>
          <StyledTagButton
            id={ids.save}
            disabled={saving}
            aria-busy={saving}
            onClick={() => {
              onSave(name);
            }}
          >
            Save
          </StyledTagButton>
        </Grid>
        <Grid sx={{paddingLeft: '1px'}} size={{xs: 6}}>
          <StyledTagButton
            id={ids.cancel}
            onClick={() => {
              onCancel();
            }}
          >
            Cancel
          </StyledTagButton>
        </Grid>
      </Grid>
    </StyledTagFormContainer>
  );
};
