/**
 * Remove flag `name` and the value after it from `args`, returning the value
 * (undefined when the flag is absent, or last with no value).
 */
export function takeFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args.splice(index, 2)[1];
}
