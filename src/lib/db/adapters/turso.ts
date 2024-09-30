import {Client, createClient} from '@libsql/client';
import type {IEntry, IJunction, ITag, IUser} from '../types';
import type {ITearleadsDB} from '../types';

class TearleadsTurso implements ITearleadsDB {
  private client: Client;

  constructor() {
    this.client = createClient({
      url: 'file:database.db',
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async putUser(user: IUser): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getUser(username: string): Promise<IUser | undefined> {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async putTag(tag: ITag): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async putEntry(entry: IEntry): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async putJunction(junction: IJunction): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getTagsForUserName(username: string): Promise<ITag[]> {
    const tags: ITag[] = [];
    return tags;
  }
}

export {TearleadsTurso};
