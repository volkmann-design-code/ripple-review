/*
 * Serves the production build (dist/browser) as the hosting does: files as
 * they are, every other path answered by index.html (see public/.htaccess).
 * For the screenshots: `bun shots/serve.ts [port]`.
 */
import { join } from "node:path";

const root = join(import.meta.dir, "../dist/browser");
const port = Number(process.argv[2] ?? 4300);

Bun.serve({
  port,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    const file = Bun.file(join(root, path));
    if (!path.includes("..") && path !== "/" && (await file.exists())) {
      return new Response(file);
    }
    return new Response(Bun.file(join(root, "index.html")), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
});
console.log(`serving ${root} on http://localhost:${port}`);
