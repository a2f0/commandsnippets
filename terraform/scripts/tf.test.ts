import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import {chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Runs scripts/tf against fake `sops` and `terraform` executables.
const script = join(import.meta.dir, 'tf');
const stacksDir = join(import.meta.dir, '..', 'stacks');
let bin = '';
let calls = '';

const SECRETS = [
  'CLOUDFLARE_API_TOKEN=scoped-token',
  'AWS_ACCESS_KEY_ID=state-key-id',
  'AWS_SECRET_ACCESS_KEY=state-secret',
].join('\n');

function fake(name: string, body: string) {
  const path = join(bin, name);
  writeFileSync(path, `#!/bin/bash\n${body}\n`);
  chmodSync(path, 0o755);
}

function run(args: string[], env: Record<string, string> = {}) {
  const result = Bun.spawnSync(['bash', script, ...args], {
    env: {PATH: `${bin}:/usr/bin:/bin`, HOME: bin, ...env},
    stdout: 'pipe',
    stderr: 'pipe',
  });
  let terraform: {args: string[]; env: Record<string, string>} | undefined;
  try {
    terraform = JSON.parse(readFileSync(calls, 'utf8'));
  } catch {
    terraform = undefined;
  }
  return {code: result.exitCode, stderr: result.stderr.toString(), terraform};
}

beforeEach(() => {
  bin = mkdtempSync(join(tmpdir(), 'tf-wrapper-'));
  calls = join(bin, 'terraform-call.json');
  // Record the arguments and the credential variables Terraform would see.
  fake(
    'terraform',
    `python3 - "$@" <<'PY'
import json, os, sys
names = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CLOUDFLARE_EMAIL",
         "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_PROFILE"]
json.dump({"args": sys.argv[1:], "env": {n: os.environ[n] for n in names if n in os.environ}},
          open("${calls}", "w"))
PY`
  );
});

afterEach(() => {
  rmSync(bin, {recursive: true, force: true});
});

describe('scripts/tf', () => {
  test('runs Terraform in the stack with only the decrypted credentials', () => {
    fake('sops', `cat <<'EOF'\n${SECRETS}\nEOF`);
    const {code, terraform} = run(['staging', 'plan', '-out=x.tfplan'], {
      CLOUDFLARE_API_TOKEN: 'inherited-token',
      CLOUDFLARE_API_KEY: 'inherited-global-key',
      AWS_PROFILE: 'root',
    });
    expect(code).toBe(0);
    expect(terraform?.args).toEqual([
      `-chdir=${join(stacksDir, 'staging')}`,
      'plan',
      '-out=x.tfplan',
    ]);
    expect(terraform?.env).toEqual({
      CLOUDFLARE_API_TOKEN: 'scoped-token',
      AWS_ACCESS_KEY_ID: 'state-key-id',
      AWS_SECRET_ACCESS_KEY: 'state-secret',
    });
  });

  test('stops, without running Terraform, when decryption fails', () => {
    fake('sops', 'echo "no GPG key" >&2; exit 128');
    const {code, stderr, terraform} = run(['zone', 'plan'], {
      CLOUDFLARE_API_TOKEN: 'inherited-token',
    });
    expect(code).toBe(1);
    expect(stderr).toContain('could not decrypt');
    expect(terraform).toBeUndefined();
  });

  test('stops when a credential is missing from the secrets', () => {
    fake('sops', `cat <<'EOF'\nCLOUDFLARE_API_TOKEN=scoped-token\nEOF`);
    const {code, stderr, terraform} = run(['zone', 'plan'], {
      AWS_ACCESS_KEY_ID: 'inherited-key',
      AWS_SECRET_ACCESS_KEY: 'inherited-secret',
    });
    expect(code).toBe(1);
    expect(stderr).toContain('AWS_ACCESS_KEY_ID is missing');
    expect(terraform).toBeUndefined();
  });

  test('rejects an unknown stack with the list of stacks', () => {
    fake('sops', `cat <<'EOF'\n${SECRETS}\nEOF`);
    const {code, stderr, terraform} = run(['prod', 'plan']);
    expect(code).toBe(2);
    expect(stderr).toContain('<production|staging|zone>');
    expect(terraform).toBeUndefined();
  });
});
