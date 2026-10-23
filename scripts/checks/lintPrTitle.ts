import { spawnSync } from "node:child_process";
import path from "node:path";

const title = process.env["PR_TITLE"];
if (!title?.trim() || /[\r\n]/.test(title)) {
  throw new Error("PR_TITLE must be a nonempty single line.");
}
const root = path.resolve(import.meta.dirname, "../..");
const result = spawnSync(path.join(root, "node_modules/.bin/commitlint"), [
  "--config", path.join(root, "commitlint.config.mts"),
], { cwd: root, input: title, stdio: ["pipe", "inherit", "inherit"] });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
