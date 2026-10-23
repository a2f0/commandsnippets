/** Run a command to completion, capturing its output and exit code. */
export async function run(
  command: string[],
  options: {cwd?: string; stdin?: 'ignore' | ReturnType<typeof Bun.file>} = {}
): Promise<{stdout: string; stderr: string; code: number}> {
  const proc = Bun.spawn(command, {...options, stdout: 'pipe', stderr: 'pipe'});
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return {stdout, stderr, code};
}
