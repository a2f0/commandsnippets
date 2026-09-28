/** Malformed command-line arguments: the script prints its usage, exit 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/**
 * Remove flag `name` and the value after it from `args`, returning the value
 * (undefined when the flag is absent). A flag with no value after it, or with
 * another flag where its value belongs (`--format --output x`), is a
 * UsageError: running on the default instead could quietly target the wrong
 * database or file.
 */
export function takeFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new UsageError(`${name} needs a value`);
  }
  args.splice(index, 2);
  return value;
}

/**
 * `parse()`, or undefined after printing `usage` when it throws a UsageError
 * (the caller then exits 2). Other errors propagate.
 */
export function parseOrUsage<T>(
  parse: () => T,
  usage: string,
  out: (line: string) => void
): T | undefined {
  try {
    return parse();
  } catch (error) {
    if (!(error instanceof UsageError)) {
      throw error;
    }
    out(usage);
    return undefined;
  }
}
