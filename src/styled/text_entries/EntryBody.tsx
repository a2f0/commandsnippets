import React from 'react';

const style = {
  fontSize: 14,
  fontFamily: 'monospace',
  'white-space': 'pre-wrap',
};

export interface IProps {
  handleClick: () => void;
  value: string;
}

const EntryBody = ({handleClick, value}: IProps) => {
  return (
    <div onClick={handleClick} style={style}>
      {value}
    </div>
  );
};
export default React.memo(EntryBody);
