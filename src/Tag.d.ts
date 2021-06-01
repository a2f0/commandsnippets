interface ITagProps {
  id: number;
  tag: ITag;
  user: IUser;
  fetchTags: () => void;
  moveEntry: (id: number, atIndex: number) => void;
  findEntry: (id: number) => {entry: ITag; index: number};
  index: number;
  findEntryByIndex: ITag | null;
}
declare const Tag: React.FunctionComponent<ITagProps>;
export default Tag;
