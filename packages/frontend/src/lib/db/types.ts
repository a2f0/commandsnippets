export interface IUser {
  id: string;
  username: string;
  updated: number;
}

export interface ITag {
  id: string;
  userId: string | undefined;
  name: string;
  updated: number;
  entryCount: number;
  synced: boolean;
  deleted: boolean;
}

export interface IEntry {
  id: string;
  userId: string | undefined;
  subject: string;
  body: string;
  updated: number;
  synced: boolean;
  deleted: boolean;
}

export interface IJunction {
  id: string;
  userId: string | undefined;
  entryId: string;
  tagId: string;
  updated: number;
  order: number;
  synced: boolean;
  deleted: boolean;
}

export interface ICommandsnippetsDB {
  close: () => Promise<void>;
  getTagsForUserName: (username: string) => Promise<ITag[]>;
  putUser: (user: IUser) => Promise<void>;
  getUser: (username: string) => Promise<IUser | undefined>;
  putTag: (tag: ITag) => Promise<void>;
  putEntry: (entry: IEntry) => Promise<void>;
  putJunction: (junction: IJunction) => Promise<void>;
}

export interface IDatabase {
  db: ICommandsnippetsDB;
}
