import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import {useState} from 'react';
import {useDocumentKeydown} from '../../hooks/useDocumentKeydown';
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
  /** Cancel, or Escape anywhere while the form is open. */
  onCancel: () => void;
  /** New tags cycle name/Save/Cancel; renames retain native Tab. */
  cycleFields?: boolean;
  /** Why the last save failed (none: it did not). */
  error?: string | null;
}

/** The name field, Save and Cancel of a new tag's form and a tag's editor. */
export const TagForm = ({
  ids,
  name: initialName,
  onSave,
  onCancel,
  cycleFields = false,
  error = null,
}: ITagFormProps) => {
  const owner = useEditorOwnership(appMode.tagEditor, cycleFields);
  useEditFieldCycle(owner, cycleFields);
  const [name, setName] = useState<string>(initialName);
  useDocumentKeydown(event => {
    if (event.code === 'Escape') {
      onCancel();
    }
  });

  return (
    <StyledTagFormContainer
      id={ids.form}
      ref={owner.ref}
      onFocusCapture={owner.onFocusCapture}
    >
      <StyledTextFieldTags
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
