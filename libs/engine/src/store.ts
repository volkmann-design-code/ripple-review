export { MemoryStore, type Store } from "@ripple-review/core/store";

/** Hex SHA-256 of a string, with Web Crypto (browsers, Bun, Node). */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
