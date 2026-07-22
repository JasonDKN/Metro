// Small dependency-free id generator. Not cryptographically strong — it
// doesn't need to be, this is just for keying local records.
export function makeId(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
}
