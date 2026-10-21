// Rejection sampling keeps every eligible member exactly equally likely.
export function uniformIndex(size, source = globalThis.crypto) {
  if (!Number.isInteger(size) || size < 1 || size > 10000) throw new RangeError('Invalid pool size');
  const range = 0x100000000;
  const limit = range - (range % size);
  const value = new Uint32Array(1);
  do { source.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % size;
}
export function simplifyName(name) {
  return name.normalize('NFKC').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}
export function cleanNames(text) {
  const seen = new Set();
  return text.split(/\r?\n/).map(simplifyName).filter(name => {
    const key = name.replace(/\s+/g, ' ').toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
