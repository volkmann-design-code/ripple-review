import { adapterContext, MemorySnapshot } from "@ripple-review/core/snapshot";
import { describe, expect, it } from "vitest";
import { Kirby } from "./kirby.ts";

const files: Record<string, string> = {
  "composer.json": "{}",
  "site/blueprints/pages/article.yml": "title: Article\n",
  "site/models/article.php": "<?php class ArticlePage extends Page {}",
  "site/templates/article.php":
    "<?php snippet('header') ?><?php snippet('article', ['a' => $page]) ?>",
  "site/snippets/header.php": "<header></header>",
  "site/snippets/article.php": "<article></article>",
  "site/collections/articles.php":
    "<?php return fn () => page('blog')->children();",
  "site/controllers/article.php":
    "<?php return fn () => ['articles' => collection('articles')];",
  "site/controllers/article.json.php": "<?php return fn () => [];",
  "site/templates/home.php": "<?php",
  "plugins/shop/index.php": "<?php Kirby::plugin('acme/shop', []);",
  "plugins/shop/blueprints/pages/shop-order.yml": [
    "title: Order",
    "tabs:",
    "  content:",
    "    extends: tabs/shop-order-lines",
    "  payments: tabs/shop-payments",
  ].join("\n"),
  "plugins/shop/blueprints/tabs/shop-order-lines.yml": "label: Lines\n",
  "plugins/shop/blueprints/tabs/shop-payments.yml": "label: Payments\n",
  "docs/blueprints/pages/example.yml": "title: Example\n",
};

async function rule(paths: Record<string, string> = files) {
  const r = new Kirby();
  const found = await r.detect(await adapterContext(new MemorySnapshot(paths)));
  return { r, found };
}

const facts = async (path: string) =>
  (await rule()).r.file({ path, content: files[path] });

describe("Kirby", () => {
  it("is detected by a site's or a plugin's blueprints", async () => {
    expect((await rule()).found).toBe(true);
    expect(
      (await rule({ "docs/blueprints/pages/example.yml": "title: x" })).found,
    ).toBe(false);
  });

  it("names a blueprint by its id, a page's also by its template", async () => {
    expect(
      (await facts("plugins/shop/blueprints/tabs/shop-payments.yml"))
        ?.definitions,
    ).toEqual(["tabs/shop-payments"]);
    expect(
      (await facts("site/blueprints/pages/article.yml"))?.definitions,
    ).toEqual(["pages/article", "article"]);
  });

  it("reads the blueprints a blueprint extends or uses as its parts", async () => {
    expect(
      (await facts("plugins/shop/blueprints/pages/shop-order.yml"))?.parts,
    ).toEqual([
      "plugins/shop/blueprints/tabs/shop-order-lines.yml",
      "plugins/shop/blueprints/tabs/shop-payments.yml",
    ]);
  });

  it("reads a page's blueprint, model and controller before its template", async () => {
    expect((await facts("site/models/article.php"))?.dependsOn).toEqual([
      { path: "site/blueprints/pages/article.yml", via: "model of" },
    ]);
    expect(
      (await facts("site/controllers/article.json.php"))?.dependsOn,
    ).toEqual([
      { path: "site/blueprints/pages/article.yml", via: "controller of" },
      { path: "site/models/article.php", via: "uses the model" },
    ]);
    expect((await facts("site/templates/article.php"))?.dependsOn).toEqual([
      { path: "site/blueprints/pages/article.yml", via: "template of" },
      { path: "site/models/article.php", via: "uses the model" },
      { path: "site/controllers/article.php", via: "gets its variables from" },
    ]);
    expect(await facts("site/templates/home.php")).toBeUndefined();
  });

  it("reads snippets as parts, collections first", async () => {
    expect((await facts("site/templates/article.php"))?.parts).toEqual([
      "site/snippets/header.php",
      "site/snippets/article.php",
    ]);
    expect(
      (await facts("site/controllers/article.php"))?.dependsOn,
    ).toContainEqual({
      path: "site/collections/articles.php",
      via: "uses the collection",
    });
  });

  it("calls blueprints schema, outside sites and plugins nothing", async () => {
    const { r } = await rule();
    expect(r.roleHint("site/blueprints/pages/article.yml")).toBe("schema");
    expect(r.roleHint("docs/blueprints/pages/example.yml")).toBeUndefined();
    expect(
      r.file({ path: "docs/blueprints/pages/example.yml", content: "" }),
    ).toBeUndefined();
  });
});
