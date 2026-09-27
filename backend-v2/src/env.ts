import type {Db} from './db/client';
import type {User} from './db/schema';

/** Secrets set with `wrangler secret put` (or `.dev.vars` locally). */
export interface Secrets {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ELECTRON_GITHUB_CLIENT_ID: string;
  ELECTRON_GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

export type Bindings = Env & Secrets;

export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    db: Db;
    user: User | null;
  };
}
