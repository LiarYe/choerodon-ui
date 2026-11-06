export default function mapToObject<V>(map: ReadonlyMap<string, V>): { [key: string]: V } {
  const result: { [key: string]: V } = {};
  map.forEach((value, key) => {
    Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
  });
  return result;
}
