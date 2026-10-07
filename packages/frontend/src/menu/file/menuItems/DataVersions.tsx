import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {useAppState} from '../../../lib/state/appState';
import {StyledMenuItem} from '../../StyledMenuItem';
import {DataVersionsDialog} from './DataVersionsDialog';

interface IProps {
  onClose: () => void;
}

/** File > Data Versions: the signed-in user's versions of their data. */
const DataVersions = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const loggedInUser = useAppState(appState => appState.loggedInUser);
  // The dialog is for the user who opened it: another signing in closes it.
  const [openFor, setOpenFor] = React.useState<string | null>(null);

  const handleClick = () => {
    onClose();
    setOpenFor(loggedInUser);
  };

  return (
    <>
      <StyledMenuItem id="file-menu-data-versions" onClick={handleClick}>
        {t('dataVersions')}
      </StyledMenuItem>
      {openFor !== null && (
        <DataVersionsDialog
          open={openFor === loggedInUser}
          username={openFor}
          onClose={() => setOpenFor(null)}
        />
      )}
    </>
  );
};

const memoizedDataVersions = React.memo(DataVersions);

export {memoizedDataVersions as DataVersions};
