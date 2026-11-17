import {describe, expect, test} from 'bun:test';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import gatePolicy from './ciGate.json';
import {CI_SCOPES, ciDiffRange, ciScopes} from './ciPolicy';

const root = path.resolve(import.meta.dirname, '../..');
function assertCiSuccess(needs: unknown): void {
  const result = spawnSync(
    path.join(root, 'node_modules/.bin/agent-tool'),
    ['ci', 'gate', '-', '--policy', 'scripts/checks/ciGate.json'],
    {cwd: root, input: JSON.stringify(needs), encoding: 'utf8'}
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
}

type Workflow = {
  on: {
    push?: {branches?: string[]; paths?: string[]};
    workflow_call?: {inputs?: Record<string, unknown>};
  };
  jobs: Record<
    string,
    {
      needs?: string | string[];
      if?: string;
      with?: Record<string, unknown>;
      concurrency?: unknown;
      outputs?: Record<string, string>;
      steps?: Array<{id?: string; if?: string; run?: string}>;
    }
  >;
};

/** A GitHub Actions expression, `${{ body }}`. */
const expression = (body: string) => `\${{ ${body} }}`;

async function readWorkflow(name: string): Promise<Workflow> {
  return Bun.YAML.parse(
    await Bun.file(path.join(root, '.github/workflows', name)).text()
  ) as Workflow;
}

// A push has no pull request base, so change detection runs every lane:
// the latest run on main checks the whole tree its merges combined into.
test('CI runs on every push to main, with no paths filter', async () => {
  const workflow = await readWorkflow('ci.yml');
  expect(workflow.on.push?.branches).toContain('main');
  expect(workflow.on.push?.paths).toBeUndefined();
});

// CI runs these lanes on every push to main, so their own push triggers
// would run them twice there.
test.each(['frontend.yml', 'backend-v2.yml'])(
  '%s runs on its own only for pushes to staging',
  async name => {
    expect((await readWorkflow(name)).on.push?.branches).toEqual(['staging']);
  }
);

describe('backend-v2 deploy', () => {
  test('CI asks for it on a push to main only', async () => {
    const ci = await readWorkflow('ci.yml');
    expect(ci.jobs['backend-v2']?.with).toEqual({
      deploy: expression(
        "github.event_name == 'push' && github.ref == 'refs/heads/main'"
      ),
    });
    const backend = await readWorkflow('backend-v2.yml');
    expect(backend.on.workflow_call?.inputs?.['deploy']).toMatchObject({
      type: 'boolean',
      default: false,
    });
  });

  // Production from CI's call, staging from the standalone workflow (a called
  // workflow sees its caller's context), never for a pull request or a manual
  // run, and only after the tests and while the repository variable allows it.
  test('needs the tests and runs only for an allowed push', async () => {
    const {jobs} = await readWorkflow('backend-v2.yml');
    expect(jobs['tip']?.needs).toBe('test');
    expect(jobs['tip']?.if).toBe(
      "github.event_name == 'push' && " +
        "vars.BACKEND_V2_DEPLOY == 'true' && " +
        "((github.workflow == 'Backend v2 CI' && github.ref == 'refs/heads/staging') || " +
        "(inputs.deploy && github.ref == 'refs/heads/main'))"
    );
    expect(jobs['deploy']?.needs).toEqual(['test', 'tip']);
    expect(jobs['deploy']?.if).toBe("needs.tip.outputs.current == 'true'");
  });

  // A run whose tests finish after a newer push must not deploy older code:
  // it is checked before it queues for the lock, so it cannot replace the
  // newer run's waiting deploy, and again inside the lock, before it ships.
  test('stands down when a newer push superseded its commit', async () => {
    const {jobs} = await readWorkflow('backend-v2.yml');
    const check = 'sh scripts/checks/ciBranchTip.sh';
    expect(jobs['tip']?.steps?.find(step => step.id === 'tip')?.run).toBe(
      check
    );
    expect(jobs['tip']?.outputs).toEqual({
      current: expression('steps.tip.outputs.current'),
    });
    const steps = jobs['deploy']?.steps ?? [];
    const tip = steps.findIndex(step => step.id === 'tip');
    expect(steps[tip]?.run).toBe(check);
    const shipping = steps.filter(step => step.run?.includes('wrangler'));
    expect(shipping).toHaveLength(2);
    for (const step of shipping) {
      expect(steps.indexOf(step)).toBeGreaterThan(tip);
      expect(step.if).toBe("steps.tip.outputs.current == 'true'");
    }
  });

  test('never cancels a deploy in progress', async () => {
    const deploy = (await readWorkflow('backend-v2.yml')).jobs['deploy'];
    expect(deploy?.concurrency).toEqual({
      group: `backend-v2-deploy-${expression('github.ref')}`,
      'cancel-in-progress': false,
    });
  });
});

test('gate policy covers every classified scope', () => {
  expect(gatePolicy.conditional.map(rule => rule.output).sort()).toEqual(
    Object.keys(CI_SCOPES).sort()
  );
  expect(gatePolicy.conditional.every(rule => rule.source === 'changes')).toBe(
    true
  );
});

const sha = (c: string) => c.repeat(40);

describe('ciDiffRange', () => {
  test('uses a three-dot range between full SHAs', () => {
    expect(ciDiffRange(sha('a'), sha('b'))).toBe(`${sha('a')}...${sha('b')}`);
  });

  test('has no range for a new branch or missing base', () => {
    expect(ciDiffRange(undefined, sha('b'))).toBeUndefined();
    expect(ciDiffRange(sha('0'), sha('b'))).toBeUndefined();
  });

  test('rejects abbreviated or missing SHAs', () => {
    expect(() => ciDiffRange('abc123', sha('b'))).toThrow('full base and head');
    expect(() => ciDiffRange(sha('a'), undefined)).toThrow(
      'full base and head'
    );
  });
});

describe('ciScopes', () => {
  test('selects tooling for packages, scripts, and tooling config', () => {
    for (const path of [
      'agent-tool.json',
      '.agent-tool-skills.json',
      '.agent-tool-permissions.json',
      '.agents/skills/ship-pr/SKILL.md',
      '.claude/skills/ship-pr/SKILL.md',
      '.claude/settings.json',
      '.codex/rules/agent-tool.rules',
      'scripts/git/hooks/pre-push',
      'commitlint.config.mts',
      'tsconfig.base.json',
      'terraform/scripts/tf.test.ts',
    ]) {
      expect(ciScopes([path]).tooling).toBe(true);
    }
  });

  // The root typecheck covers Terraform's TypeScript; the terraform lane
  // lints and tests the wrapper.
  test("Terraform's TypeScript runs the tooling and terraform lanes", () => {
    expect(ciScopes(['terraform/scripts/tf.test.ts'])).toMatchObject({
      tooling: true,
      terraform: true,
    });
    expect(ciScopes(['terraform/scripts/tf'])).toMatchObject({
      tooling: false,
      terraform: true,
    });
  });

  test('selects application lanes by their paths', () => {
    expect(ciScopes(['packages/backend-v2/src/app.ts'])).toEqual({
      tooling: false,
      frontend: false,
      backendV2: true,
      apiShared: false,
      website: false,
      terraform: false,
    });
    expect(ciScopes(['packages/frontend/src/App.tsx'])).toEqual({
      tooling: false,
      frontend: true,
      backendV2: false,
      apiShared: false,
      website: false,
      terraform: false,
    });
    expect(ciScopes(['packages/api-shared/src/index.ts'])).toEqual({
      tooling: false,
      frontend: true,
      backendV2: true,
      apiShared: true,
      website: false,
      terraform: false,
    });
    expect(ciScopes(['scripts/testing/runWebdriverTests.sh']).frontend).toBe(
      true
    );
    // The spec launchers are linted and tested by the tooling lane.
    expect(
      ciScopes(['packages/frontend/scripts/testing/runSpec.sh'])
    ).toMatchObject({
      tooling: true,
      frontend: true,
    });
    expect(ciScopes(['terraform/stacks/zone/main.tf'])).toEqual({
      tooling: false,
      frontend: false,
      backendV2: false,
      apiShared: false,
      website: false,
      terraform: true,
    });
    expect(ciScopes(['packages/website/src/pages/index.astro'])).toEqual({
      tooling: false,
      frontend: false,
      backendV2: false,
      apiShared: false,
      website: true,
      terraform: false,
    });
  });

  test.each(['runUnitTests', 'runWebdriverTests', 'runBrowserAcquisition'])(
    '%s runs frontend CI on pull requests and staging pushes',
    async name => {
      const script = `scripts/testing/${name}.sh`;
      expect(ciScopes([script])).toMatchObject({
        tooling: true,
        frontend: true,
      });
      expect((await readWorkflow('frontend.yml')).on.push?.paths).toContain(
        script
      );
    }
  );

  test('brand sources and image settings run the web package lanes', () => {
    expect(ciScopes(['assets/brand/logo.svg'])).toEqual({
      tooling: false,
      frontend: true,
      backendV2: false,
      apiShared: false,
      website: true,
      terraform: false,
    });
    expect(ciScopes(['agent-tool.json'])).toEqual({
      tooling: true,
      frontend: true,
      backendV2: false,
      apiShared: false,
      website: true,
      terraform: false,
    });
  });

  test('file-name rules run the frontend lane', () => {
    expect(ciScopes(['.ls-lint.yml'])).toEqual({
      tooling: false,
      frontend: true,
      backendV2: false,
      apiShared: false,
      website: false,
      terraform: false,
    });
  });

  test('Markdown runs the tooling lane, which lints it', () => {
    for (const path of [
      'README.md',
      'docs/ci-merge-gate.md',
      'packages/frontend/AGENTS.md',
      '.markdownlint-cli2.jsonc',
    ]) {
      expect(ciScopes([path])).toMatchObject({tooling: true, website: false});
    }
  });

  test('skips every lane for unrelated paths', () => {
    expect(ciScopes(['NOTICE', 'docs/diagram.svg'])).toEqual({
      tooling: false,
      frontend: false,
      backendV2: false,
      apiShared: false,
      website: false,
      terraform: false,
    });
  });

  test('workflow, toolchain, workspace install and shared lint changes run every lane', () => {
    for (const path of [
      '.github/workflows/frontend.yml',
      '.github/actions/setup/action.yml',
      'bun.lock',
      'bunfig.toml',
      '.mise.toml',
      'mise.lock',
      'package.json',
      'biome.json',
      'knip.config.ts',
      'scripts/checks/ciPolicy.ts',
    ]) {
      expect(Object.values(ciScopes([path])).every(Boolean)).toBe(true);
    }
  });
});

describe('assertCiSuccess', () => {
  const scopes = (value: string) => ({
    result: 'success',
    outputs: {
      tooling: value,
      frontend: value,
      backendV2: value,
      apiShared: value,
      website: value,
      terraform: value,
    },
  });
  const jobs = (result: string) => ({
    tooling: {result},
    'backend-v2': {result},
    'api-shared': {result},
    frontend: {result},
    website: {result},
    terraform: {result},
  });

  test('passes when required lanes succeeded or irrelevant ones skipped', () => {
    expect(() =>
      assertCiSuccess({changes: scopes('true'), ...jobs('success')})
    ).not.toThrow();
    expect(() =>
      assertCiSuccess({changes: scopes('false'), ...jobs('skipped')})
    ).not.toThrow();
  });

  test('each lane follows its own scope', () => {
    const changes = {
      result: 'success',
      outputs: {
        tooling: 'false',
        frontend: 'true',
        backendV2: 'false',
        apiShared: 'false',
        website: 'false',
        terraform: 'false',
      },
    };
    const needs = {
      changes,
      tooling: {result: 'skipped'},
      'backend-v2': {result: 'success'},
      'api-shared': {result: 'skipped'},
      frontend: {result: 'success'},
      website: {result: 'skipped'},
      terraform: {result: 'skipped'},
    };
    expect(() => assertCiSuccess(needs)).toThrow(
      'backend-v2: expected skipped'
    );
  });

  test("api-shared changes require its lane and its consumers' lanes", () => {
    const changes = {
      result: 'success',
      outputs: {
        tooling: 'false',
        frontend: 'true',
        backendV2: 'true',
        apiShared: 'true',
        website: 'false',
        terraform: 'false',
      },
    };
    const needs = {
      changes,
      ...jobs('skipped'),
      'backend-v2': {result: 'success'},
      'api-shared': {result: 'success'},
      frontend: {result: 'success'},
    };
    expect(() => assertCiSuccess(needs)).not.toThrow();
    expect(() =>
      assertCiSuccess({...needs, 'api-shared': {result: 'skipped'}})
    ).toThrow('api-shared: expected success');
    expect(() =>
      assertCiSuccess({...needs, 'backend-v2': {result: 'skipped'}})
    ).toThrow('backend-v2: expected success');
  });

  test('fails when change detection did not succeed', () => {
    expect(() =>
      assertCiSuccess({changes: {result: 'failure'}, ...jobs('skipped')})
    ).toThrow('changes: expected success');
  });

  test('fails a required lane that failed, was cancelled, or skipped', () => {
    for (const result of ['failure', 'cancelled', 'skipped']) {
      expect(() =>
        assertCiSuccess({
          changes: scopes('true'),
          ...jobs('success'),
          frontend: {result},
        })
      ).toThrow('frontend: expected success');
    }
  });

  test('fails an irrelevant lane that ran anyway or went missing', () => {
    expect(() =>
      assertCiSuccess({
        changes: scopes('false'),
        ...jobs('skipped'),
        frontend: {result: 'success'},
      })
    ).toThrow('frontend: expected skipped');
    const {frontend: _frontend, ...withoutFrontend} = jobs('skipped');
    expect(() =>
      assertCiSuccess({changes: scopes('false'), ...withoutFrontend})
    ).toThrow('frontend: expected skipped');
  });

  test('fails on a missing or malformed scope output', () => {
    expect(() =>
      assertCiSuccess({changes: scopes('maybe'), ...jobs('success')})
    ).toThrow("must succeed and produce 'true' or 'false'");
  });
});
