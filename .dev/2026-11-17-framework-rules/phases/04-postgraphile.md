---
id: 04-postgraphile
title: "PostGraphile"
status: review
depends_on: [01-port-and-graphile-migrate]
branch: frameworks-04-postgraphile
pr: 23
updated: 2026-11-17
---

# 04 PostGraphile

D1.

- [x] Detected by `postgraphile` in a package.json; tables and views
      define their GraphQL names by both the default inflection and the
      simplify inflector (`product_campaign` → `ProductCampaign`,
      `productCampaign(s)`, `allProductCampaigns`, `…ById`,
      `create/update/delete…`), functions their camelCase name.
- [x] Computed columns `table_fn(t table)` → `fn`; smart comments
      `@name x` → the names of `x`.
- [x] Schemas named `*_hidden` / `*_private` aren't exposed
      (graphile-starter's convention); respellings of three words and more
      are left to generic name matching (no duplicate notes).
- [x] Corpus measures byte-identical; no golden changed. With and without
      the rule, 13 recordings that change SQL compared: one private PR
      gains 10 links (new web queries and mutations to the migration that
      creates their tables), all within a group it already had.
      `SAVED_REVIEWS.version` 5.
- Not done: names given by smart tags in code (a tags file instead of a
  comment), relation fields (`…By<Fk>`), irregular plurals (`person` →
  `people`).
