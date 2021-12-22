import Highlighter from 'react-highlight-words';
import {ITextEntryJsonApi} from '../../models/TextEntryModel';
import React from 'react';
import {Theme} from '@mui/material/styles';
import {observer} from 'mobx-react';
import {useAppContext} from '../../AppContext';
import {useTheme} from '@mui/styles';
import {verticalPanel} from '../../lib/shared';

export interface IProps {
  handleClick: () => void;
  object: ITextEntryJsonApi;
}

const EntryBody = ({object, handleClick}: IProps) => {
  const appConfig = useAppContext();
  const theme: Theme = useTheme();

  const style = {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontFamily: 'monospace',
  };

  // This is being done because the Highlighter component leaves whitespace between lines.
  // so when the background color is set it seems unable to make the multi-line
  // background color look contiguoous.
  const styleOuterDiv = {
    backgroundColor: theme.palette.background.paper,
  };

  if (
    object.id === appConfig.entrySelectedID &&
    appConfig.tagsOrEntries === verticalPanel.entries
  ) {
    styleOuterDiv.backgroundColor = theme.selected.background;
    style.color = theme.selected.foreground;
  }

  return (
    <div style={styleOuterDiv}>
      <Highlighter
        style={style}
        searchWords={[`${appConfig.entrySearchString}`]}
        autoEscape={true}
        onClick={handleClick}
        textToHighlight={object.attributes.body}
      />
    </div>
  );
};
export default React.memo(observer(EntryBody));
