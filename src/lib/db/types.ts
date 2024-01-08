export interface IUser {
  id: string;
  username: string;
  updated: number;
}

export interface ITag {
  id: string;
  name: string;
  userId: string;
  updated: number;
}

export interface IEntry {
  id: string;
  subject: string;
  body: string;
  updated: number;
}

export interface IJunction {
  id: string;
  entryId: string;
  tagId: string;
  userId: string;
  updated: number;
  order: number;
}
