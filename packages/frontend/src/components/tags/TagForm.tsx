import Grid from '@mui/material/Grid';
import type React from 'react';
import {useEffect, useEffectEvent, useState} from 'react';
import {StyledTagButton} from './StyledTagButton';
import {StyledTagFormContainer} from './StyledTagFormContainer';
import {StyledTextFieldTags} from './StyledTextFieldTags';

export interface ITagFormProps {
  /** The ids of the form, its name field and its buttons. */
  ids: {form: string; name: string; save: string; cancel: string};
  /** The name the field opens with. */
  name: string;
  /** Save the name the field holds. */
  onSave: (name: string) => void;
  /** Cancel, or Escape anywhere while the form is open. */
  onCancel: () => void;
  nameRef?: React.Ref<HTMLInputElement>;
  saveRef?: React.Ref<HTMLButtonElement>;
  cancelRef?: React.Ref<HTMLButtonElement>;
}

/** The name field, Save and Cancel of a new tag's form and a tag's editor. */
export const TagForm = ({
  ids,
  name: initialName,
  onSave,
  onCancel,
  nameRef,
  saveRef,
  cancelRef,
}: ITagFormProps) => {
  const [name, setName] = useState<string>(initialName);
  const cancelOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      onCancel();
    }
  });

  useEffect(() => {
    const escFunction = (event: KeyboardEvent) => {
      cancelOnEscape(event);
    };
    document.addEventListener('keydown', escFunction, false);

    return () => {
      document.removeEventListener('keydown', escFunction, false);
    };
  }, []);

  return (
    <StyledTagFormContainer id={ids.form}>
      <StyledTextFieldTags
        ref={nameRef}
        value={name}
        id={ids.name}
        onChange={event => {
          setName(event.target.value);
        }}
      />
      <Grid container spacing={0}>
        <Grid sx={{paddingRight: '1px'}} size={{xs: 6}}>
          <StyledTagButton
            ref={saveRef}
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
            ref={cancelRef}
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
