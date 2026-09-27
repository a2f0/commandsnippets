import type {Theme} from '@mui/material/styles';
import {useTheme} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React from 'react';
import Highlighter from 'react-highlight-words';

import {useAppContext} from '../../AppContext';
import {appMode} from '../../lib/shared';
import type {ITextEntryJsonApi} from '../../lib/store/models/TextEntryModel';

export interface IProps {
  handleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  object: ITextEntryJsonApi;
}

const EntryBody = ({object, handleClick}: IProps) => {
  const appConfig = useAppContext();
  const theme: Theme = useTheme();

  const style = {
    color: theme.palette.text.primary,
    fontFamily: 'monospace',
  };

  // This is being done because the Highlighter component leaves whitespace between lines.
  // so when the background color is set it seems unable to make the multi-line
  // background color look contiguoous.
  const styleOuterDiv = {
    backgroundColor: theme.palette.background.paper,
    fontSize: '13.333px', // Same as StyledTextareaAutosize
    lineHeight: 'normal',
  };

  if (
    object.id === appConfig.entrySelectedID &&
    appConfig.appMode === appMode.entriesList
  ) {
    styleOuterDiv.backgroundColor = theme.selected.background;
    style.color = theme.selected.foreground;
  }

  return (
    <div style={styleOuterDiv} id={`entryBodyOuterDiv${object.id}`}>
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

export const MemoizedEntryBody = React.memo(observer(EntryBody));
