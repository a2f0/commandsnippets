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

  async putUser(_user: IUser): Promise<void> {}

  async getUser(_username: string): Promise<IUser | undefined> {
    return undefined;
  }

  async putTag(_tag: ITag): Promise<void> {}

  async putEntry(_entry: IEntry): Promise<void> {}

  async putJunction(_junction: IJunction): Promise<void> {}

  async getTagsForUserName(_username: string): Promise<ITag[]> {
    const tags: ITag[] = [];
    return tags;
  }
}

export {TearleadsTurso};
