// The idiomatic key omission: the "unused" name is the point (round 12).
export function sanitize(user) {
  const { password, ...safe } = user;
  return safe;
}
