// The runtime-fact family: each line below is a deterministic guarantee of a
// runtime failure (or a key silently lost) — no context needed (round 10).
export const mode = 'strict';

export function breakThings(value) {
  mode = 'loose'; // no-const-assign: TypeError at runtime

  const config = {
    id: 1,
    id: 2, // no-dupe-keys: first key silently lost
  };

  if (value === NaN) { // use-isnan: never true
    return Math(); // no-obj-calls: TypeError
  }
  if (typeof value === 'strnig') { // valid-typeof: typo never matches
    return helper(config);
  }
  return helper(config);
}

function helper(config) {
  return config.id;
}
helper = null; // no-func-assign: breaks every later call
