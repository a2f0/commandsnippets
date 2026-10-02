import type {Theme} from '@mui/material/styles';
import {useTheme} from '@mui/material/styles';
import React from 'react';
import Highlighter from 'react-highlight-words';
import type {ITextEntryJsonApi} from '../../lib/api/responses/types';
import {useAppConfig} from '../../lib/state/appState';

export interface IProps {
  handleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  object: ITextEntryJsonApi;
  /**
   * Whether the entry is the one selected in the list: given by its row,
   * which watches that alone, so selecting another entry renders only the
   * two rows it changes.
   */
  selected: boolean;
}

const EntryBody = ({object, handleClick, selected}: IProps) => {
  const appConfig = useAppConfig();
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

  if (selected) {
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

export const MemoizedEntryBody = React.memo(EntryBody);
