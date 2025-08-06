import {type Client, createClient} from '@libsql/client';
import type {IEntry, IJunction, ITag, ITearleadsDB, IUser} from '../types';

class TearleadsTurso implements ITearleadsDB {
  private client: Client;

  constructor() {
    this.client = createClient({
      url: 'file:database.db',
    });
  }

  async close(): Promise<void> {
    this.client.close();
  }

  // @ts-ignore undeclared variable
  async putUser(_user: IUser): Promise<void> {}

  // @ts-ignore undeclared variable
  async getUser(_username: string): Promise<IUser | undefined> {
    return undefined;
  }

  // @ts-ignore undeclared variable
  async putTag(_tag: ITag): Promise<void> {}

  // @ts-ignore undeclared variable
  async putEntry(_entry: IEntry): Promise<void> {}

  // @ts-ignore undeclared variable
  async putJunction(_junction: IJunction): Promise<void> {}

  // @ts-ignore undeclared variable
  async getTagsForUserName(_username: string): Promise<ITag[]> {
    const tags: ITag[] = [];
    return tags;
  }
}

export {TearleadsTurso};
