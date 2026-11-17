import type { AdapterContext } from "@ripple-review/core/model";
import { dirOf } from "@ripple-review/core/paths";

const PACKAGE_JSON = /(^|\/)package\.json$/;
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
] as const;

/**
 * The folders of the `package.json` files that depend on `dependency` ("" for
 * the root), outside `node_modules`. The TypeScript adapter reads every
 * `package.json`, so recordings keep them.
 */
export async function packagesUsing(
  ctx: AdapterContext,
  dependency: string,
): Promise<string[]> {
  const manifests = [...ctx.paths].filter(
    (p) => PACKAGE_JSON.test(p) && !p.includes("node_modules/"),
  );
  const texts = await Promise.all(manifests.map((p) => ctx.head.read(p)));
  return manifests
    .filter((_, i) => dependsOn(texts[i], dependency))
    .map((p) => dirOf(p));
}

function dependsOn(text: string | undefined, dependency: string): boolean {
  if (text === undefined) {
    return false;
  }
  try {
    const pkg = JSON.parse(text);
    return DEPENDENCY_FIELDS.some((k) => pkg?.[k]?.[dependency]);
  } catch {
    return false;
  }
}
