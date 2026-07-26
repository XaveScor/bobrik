export function reverseMap(map: Map<string, string>): Map<string, Array<string>> {
  const reversed = new Map<string, Array<string>>();
  for (const [key, value] of map) {
    const arr = reversed.get(value) ?? [];
    arr.push(key);
    reversed.set(value, arr);
  }
  return reversed;
}
