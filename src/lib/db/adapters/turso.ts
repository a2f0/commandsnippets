import {type Client, createClient} from '@libsql/client';

import type {IEntry, IJunction, ITag, IUser} from '../types';
import type {ITearleadsDB} from '../types';

class TearleadsTurso implements ITearleadsDB {
  // @ts-ignore undeclared variable
  private client: Client;

  constructor() {
    this.client = createClient({
      url: 'file:database.db',
    });
  }

  // @ts-ignore undeclared variable
  async putUser(user: IUser): Promise<void> {}

  // @ts-ignore undeclared variable
  async getUser(username: string): Promise<IUser | undefined> {
    return undefined;
  }

  // @ts-ignore undeclared variable
  async putTag(tag: ITag): Promise<void> {}

  // @ts-ignore undeclared variable
  async putEntry(entry: IEntry): Promise<void> {}

  // @ts-ignore undeclared variable
  async putJunction(junction: IJunction): Promise<void> {}

  // @ts-ignore undeclared variable
  async getTagsForUserName(username: string): Promise<ITag[]> {
    const tags: ITag[] = [];
    return tags;
  }
}

export {TearleadsTurso};
