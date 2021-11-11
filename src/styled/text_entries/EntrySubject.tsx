import React from 'react';

const style = {
  fontSize: 14,
};

export interface IProps {
  value: string;
}

const EntrySubject = ({value}: IProps) => {
  return <div style={style}>{value}</div>;
};
export default React.memo(EntrySubject);
