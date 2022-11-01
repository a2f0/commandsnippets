import React, {useEffect} from 'react';
import Highlighter from 'react-highlight-words';
import {autorun} from 'mobx';
import {css} from '@emotion/css';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';
import {useTheme} from '@mui/material/styles';

interface IProps {
  label: string;
}

const TagLabel = ({label}: IProps) => {
  const appConfig = useAppContext();
  const theme = useTheme();

  useEffect(() => autorun(() => {}), [appConfig.tagSearchString]);

  const style = css`
    :hover {
      color: ${theme.header.menuButtonHighlight};
    }
  `;

  return (
    <Highlighter
      className={style}
      searchWords={[`${appConfig.tagSearchString}`]}
      autoEscape={true}
      textToHighlight={label}
    />
  );
};
export default React.memo(observer(TagLabel));
