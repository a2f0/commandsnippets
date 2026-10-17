import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Runs a copy of scripts/tf inside a temporary repository layout, with fixture
// `.secrets/<tier>` files and a fake `terraform`. It never reads the real
// `.secrets`.
const source = join(import.meta.dir, 'tf');
let repo = '';
let bin = '';
let script = '';
let calls = '';

function secrets(tier: string, file: string, lines: string[]) {
  const dir = join(repo, '.secrets', tier);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, file), `${lines.join('\n')}\n`);
}

function tierSecrets(tier: string) {
  secrets(tier, 'app.env', [
    `CLOUDFLARE_API_TOKEN=${tier}-token`,
    `TF_STATE_ACCESS_KEY_ID=${tier}-key-id`,
    `TF_STATE_SECRET_ACCESS_KEY=${tier}-secret`,
  ]);
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
  repo = mkdtempSync(join(tmpdir(), 'tf-wrapper-'));
  bin = join(repo, 'bin');
  mkdirSync(bin);
  mkdirSync(join(repo, 'terraform', 'scripts'), {recursive: true});
  for (const stack of ['production', 'staging', 'zone']) {
    mkdirSync(join(repo, 'terraform', 'stacks', stack), {recursive: true});
  }
  script = join(repo, 'terraform', 'scripts', 'tf');
  copyFileSync(source, script);
  calls = join(bin, 'terraform-call.json');
  // Record the arguments and the credential variables Terraform would see.
  const terraform = join(bin, 'terraform');
  writeFileSync(
    terraform,
    `#!/bin/bash
python3 - "$@" <<'PY'
import json, os, sys
names = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CLOUDFLARE_EMAIL",
         "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_PROFILE",
         "AWS_SESSION_TOKEN", "TF_STATE_ACCESS_KEY_ID",
         "TF_STATE_SECRET_ACCESS_KEY", "OTHER_SECRET"]
json.dump({"args": sys.argv[1:], "env": {n: os.environ[n] for n in names if n in os.environ}},
          open("${calls}", "w"))
PY
`
  );
  chmodSync(terraform, 0o755);
});

afterEach(() => {
  rmSync(repo, {recursive: true, force: true});
});

describe('scripts/tf', () => {
  test("runs Terraform in the stack with only its tier's credentials", () => {
    tierSecrets('staging');
    tierSecrets('prod');
    const {code, terraform} = run(['staging', 'plan', '-out=x.tfplan'], {
      CLOUDFLARE_API_TOKEN: 'inherited-token',
      CLOUDFLARE_API_KEY: 'inherited-global-key',
      AWS_PROFILE: 'root',
      AWS_SESSION_TOKEN: 'inherited-session',
      TF_STATE_ACCESS_KEY_ID: 'inherited-state-key',
    });
    expect(code).toBe(0);
    expect(terraform?.args).toEqual([
      `-chdir=${join(repo, 'terraform', 'stacks', 'staging')}`,
      'plan',
      '-out=x.tfplan',
    ]);
    // The state key reaches Terraform only as the S3 backend's AWS names.
    expect(terraform?.env).toEqual({
      CLOUDFLARE_API_TOKEN: 'staging-token',
      AWS_ACCESS_KEY_ID: 'staging-key-id',
      AWS_SECRET_ACCESS_KEY: 'staging-secret',
    });
  });

  test.each([
    ['production', 'prod'],
    ['staging', 'staging'],
    ['zone', 'prod'],
  ])('the %s stack reads the %s tier', (stack, tier) => {
    tierSecrets('staging');
    tierSecrets('prod');
    const {code, terraform} = run([stack, 'plan']);
    expect(code).toBe(0);
    expect(terraform?.args[0]).toBe(`-chdir=${join(repo, 'terraform', 'stacks', stack)}`);
    expect(terraform?.env).toEqual({
      CLOUDFLARE_API_TOKEN: `${tier}-token`,
      AWS_ACCESS_KEY_ID: `${tier}-key-id`,
      AWS_SECRET_ACCESS_KEY: `${tier}-secret`,
    });
  });

  test("stops, naming the file, when the tier's app.env is missing", () => {
    tierSecrets('staging');
    const {code, stderr, terraform} = run(['production', 'plan'], {
      CLOUDFLARE_API_TOKEN: 'inherited-token',
      AWS_ACCESS_KEY_ID: 'inherited-key',
      AWS_SECRET_ACCESS_KEY: 'inherited-secret',
    });
    expect(code).toBe(1);
    expect(stderr).toContain(`${join(repo, '.secrets', 'prod', 'app.env')} not found`);
    expect(terraform).toBeUndefined();
  });

  test('stops, naming each one, when a credential is missing', () => {
    secrets('prod', 'app.env', ['CLOUDFLARE_API_TOKEN=prod-token', 'TF_STATE_SECRET_ACCESS_KEY=']);
    const {code, stderr, terraform} = run(['zone', 'plan'], {
      AWS_ACCESS_KEY_ID: 'inherited-key',
      AWS_SECRET_ACCESS_KEY: 'inherited-secret',
      TF_STATE_ACCESS_KEY_ID: 'inherited-state-key',
    });
    const file = join(repo, '.secrets', 'prod', 'app.env');
    expect(code).toBe(1);
    expect(stderr).toContain(`TF_STATE_ACCESS_KEY_ID is missing from ${file}`);
    expect(stderr).toContain(`TF_STATE_SECRET_ACCESS_KEY is missing from ${file}`);
    expect(stderr).not.toContain('CLOUDFLARE_API_TOKEN is missing');
    expect(terraform).toBeUndefined();
  });

  test('parses the files without running them, and app.env wins over shared.env', () => {
    const marker = join(repo, 'ran');
    secrets('staging', 'shared.env', [
      'CLOUDFLARE_API_TOKEN=shared-token',
      'TF_STATE_ACCESS_KEY_ID=shared-key-id',
    ]);
    writeFileSync(
      join(repo, '.secrets', 'staging', 'app.env'),
      [
        '# comment',
        '',
        `$(touch ${marker})`,
        `touch ${marker}`,
        'OTHER_SECRET=not-for-terraform',
        'TF_STATE_ACCESS_KEY_ID=app-key-id',
        // Values keep every character after the first `=`, and the last line
        // needs no newline.
        'TF_STATE_SECRET_ACCESS_KEY=a=b c$HOME=',
      ].join('\n')
    );
    const {code, terraform} = run(['staging', 'plan']);
    expect(code).toBe(0);
    expect(existsSync(marker)).toBe(false);
    expect(terraform?.env).toEqual({
      CLOUDFLARE_API_TOKEN: 'shared-token',
      AWS_ACCESS_KEY_ID: 'app-key-id',
      AWS_SECRET_ACCESS_KEY: 'a=b c$HOME=',
    });
  });

  test('rejects an unknown stack with the list of stacks', () => {
    tierSecrets('prod');
    const {code, stderr, terraform} = run(['prod', 'plan']);
    expect(code).toBe(2);
    expect(stderr).toContain('<production|staging|zone>');
    expect(terraform).toBeUndefined();
  });

  test('rejects a stack that has no secrets tier', () => {
    tierSecrets('prod');
    mkdirSync(join(repo, 'terraform', 'stacks', 'preview'));
    const {code, stderr, terraform} = run(['preview', 'plan']);
    expect(code).toBe(2);
    expect(stderr).toContain('no secrets tier for the preview stack');
    expect(terraform).toBeUndefined();
  });
});
