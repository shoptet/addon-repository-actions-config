// `_` marks an array position skipped on purpose — not dead code.
export function splitStamp(stamp) {
  const [_, date, time] = /^(\S+) (\S+)$/.exec(stamp) || [];
  return { date, time };
}
