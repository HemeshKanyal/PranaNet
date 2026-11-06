export const log = (scope: string, ...args: unknown[]) =>
  console.log(new Date().toISOString().slice(11, 19), `[${scope}]`, ...args);
