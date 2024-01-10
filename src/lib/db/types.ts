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
}

export interface IEntry {
  id: string;
  userId: string | undefined;
  subject: string;
  body: string;
  updated: number;
  synced: boolean;
}

export interface IJunction {
  id: string;
  userId: string | undefined;
  entryId: string;
  tagId: string;
  updated: number;
  order: number;
  synced: boolean;
}
