import { adapterContext, MemorySnapshot } from "@ripple-review/core/snapshot";
import { describe, expect, it } from "vitest";
import { PostGraphile } from "./postgraphile.ts";

const files: Record<string, string> = {
  "package.json": JSON.stringify({ name: "shop" }),
  "packages/api/package.json": JSON.stringify({
    dependencies: { postgraphile: "4.14.1" },
  }),
};

async function rule(paths: Record<string, string> = files) {
  const r = new PostGraphile();
  const found = await r.detect(await adapterContext(new MemorySnapshot(paths)));
  return { r, found };
}

const definitions = async (content: string, path = "db/current.sql") =>
  (await rule()).r.file({ path, content })?.definitions;

describe("PostGraphile", () => {
  it("is detected by postgraphile in a package.json", async () => {
    expect((await rule()).found).toBe(true);
    const { "packages/api/package.json": _, ...without } = files;
    expect((await rule(without)).found).toBe(false);
  });

  it("names a table or view by both inflections", async () => {
    expect(
      await definitions("create table app_public.product_campaigns (id int);"),
    ).toEqual([
      "ProductCampaign",
      "productCampaign",
      "productCampaigns",
      "allProductCampaigns",
      "productCampaignById",
      "createProductCampaign",
      "updateProductCampaign",
      "updateProductCampaignById",
      "deleteProductCampaign",
      "deleteProductCampaignById",
    ]);
    expect(
      await definitions('create or replace view "category" as select 1;'),
    ).toContain("allCategories");
    expect(await definitions("create table address (id int);")).toContain(
      "allAddresses",
    );
  });

  it("names functions and computed columns", async () => {
    expect(
      await definitions(
        [
          "create function app_public.search_products(query text) returns setof products as $$ $$;",
          "create or replace function app_public.orders_total_amount(o app_public.orders) returns int as $$ $$;",
        ].join("\n"),
      ),
    ).toEqual(["searchProducts", "totalAmount"]);
  });

  it("leaves respellings of three words and more to generic name matching", async () => {
    expect(
      await definitions(
        "create function app_public.set_line_items(d uuid) returns void as $$ $$;",
      ),
    ).toBeUndefined();
  });

  it("follows smart comments that rename", async () => {
    expect(
      await definitions(
        "comment on table app_public.usr is E'@name person\\nA user.';",
      ),
    ).toContain("createPerson");
    expect(
      await definitions(
        "comment on function app_public.do_it(int) is E'@name run_it';",
      ),
    ).toEqual(["runIt"]);
  });

  it("leaves schemas it doesn't expose, and other files, alone", async () => {
    expect(
      await definitions(
        "create function app_hidden.campaign_covers() returns bool as $$ $$;\ncreate table app_private.sessions (id int);",
      ),
    ).toBeUndefined();
    expect(
      await definitions("create table orders (id int);", "src/orders.ts"),
    ).toBeUndefined();
  });
});
