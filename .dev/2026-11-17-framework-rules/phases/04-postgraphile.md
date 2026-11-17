---
id: 04-postgraphile
title: "PostGraphile"
status: todo
depends_on: [01-port-and-graphile-migrate]
branch: null
pr: null
updated: 2026-11-17
---

# 04 PostGraphile

D1.

- [ ] Detected by `postgraphile`; SQL functions, tables and views define
      their GraphQL spellings by the default inflection, also for 1–2 word
      names (`product_campaign` → `productCampaign`, `ProductCampaign`,
      `allProductCampaigns`).
- [ ] Computed columns `table_fn(t table)` → `fn`; smart comments `@name x`.
