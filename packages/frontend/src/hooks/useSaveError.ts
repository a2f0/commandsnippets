import {useState} from 'react';
import {useTypedTranslation} from '../i18n/hooks';

/**
 * A form's failed save: the message the form shows (null when the last save
 * did not fail). `failed` logs the write's error and shows it; `clear` hides
 * it as the next save starts. The form stays open with what the user typed.
 */
export function useSaveError(what: string) {
  const {t} = useTypedTranslation('common');
  const [error, setError] = useState<string | null>(null);
  const failed = (cause: unknown) => {
    console.error(`Failed to ${what}:`, cause);
    const message = cause instanceof Error ? cause.message : String(cause);
    setError(t('saveFailed', {message}));
  };
  return {error, failed, clear: () => setError(null)};
}
