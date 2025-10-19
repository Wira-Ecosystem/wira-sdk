// Function to stringify an object containing BigInt values, converting them to strings
// to ensure compatibility with JSON format on Bundled android apps.
export function jsonStringifyWithBigInt(obj: Object): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}
