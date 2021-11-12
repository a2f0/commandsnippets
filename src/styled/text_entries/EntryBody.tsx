import React, {useCallback, useEffect} from 'react';
import {ITextEntryJsonApi} from '../../models/TextEntryModel';
import {Theme} from '@mui/material/styles';
import {keyCode} from '../../lib/shared';
import {observer} from 'mobx-react';
import {useAppContext} from '../../AppContext';
import {useTheme} from '@mui/styles';

export interface IProps {
  handleClick: () => void;
  object: ITextEntryJsonApi;
}

const EntryBody = ({object, handleClick}: IProps) => {
  const appConfig = useAppContext();
  const theme: Theme = useTheme();

  const style = {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontSize: 14,
    fontFamily: 'monospace',
  };

  if (
    object.id === appConfig.entrySelectedID &&
    appConfig.tagsOrEntries === 'entries'
  ) {
    style.backgroundColor = theme.selected.background;
    style.color = theme.selected.foreground;
  }

  return (
    <div style={style} onClick={handleClick}>
      {object.attributes.body}
    </div>
  );
};
export default React.memo(observer(EntryBody));
