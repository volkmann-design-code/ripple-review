# Review order: Brian/um 24 event data
https://github.com/umami-software/umami/pull/1376

16 files · +229 −79 · 2 groups

## 1. Around `saveEvent.js`, `db.js` (lib/db.js, queries/analytics, pages/api)
_3 files · +27 −24_

1. [ ] [lib/db.js](https://github.com/umami-software/umami/pull/1376/files#diff-69f9a48e7478eb5df50c35b61f5638a078f274a604fff85d69732c2651ef8b47) +4 −4
2. [ ] [queries/analytics/event/saveEvent.js](https://github.com/umami-software/umami/pull/1376/files#diff-dae5f44c643e1f32ebe563bdd3488bdaf7b79a5b43e0e1a846a6ffec0b425d72) +21 −18 · mentions `getDateFormatClickhouse` from db.js
3. [ ] [pages/api/collect.js](https://github.com/umami-software/umami/pull/1376/files#diff-044c681d3f7c0903ccce5bf32861dae17971f4b1f3843a2a0626d3d5e50f864a) +2 −2 · mentions `saveEvent` from saveEvent.js

## 2. Standalone changes
_13 files · +202 −55_

4. [ ] [db/mysql/migrations/02_add_event_data/migration.sql](https://github.com/umami-software/umami/pull/1376/files#diff-4c5d2cd14dc045d65263437d1aa10a1bc8481ec5c6154277c82497fbd0dc3b5e) (new) +62 −0 · schema
5. [ ] [db/postgresql/migrations/02_add_event_data/migration.sql](https://github.com/umami-software/umami/pull/1376/files#diff-ab04b72f223cc843b0ca891f6df2e07ee93384234cb6dcbb42d38b1c50805b92) (new) +66 −0 · schema
6. [ ] [components/metrics/EventsChart.js](https://github.com/umami-software/umami/pull/1376/files#diff-66cb06c808d93f978f688b858958f4585c104e2e3507a98bcce2e7930d3a020f) +3 −3
7. [ ] [components/metrics/RealtimeLog.js](https://github.com/umami-software/umami/pull/1376/files#diff-b5f366678806c5f3aba8944a3f00cc233dfd0dae0f30c0995f2af8563ebb53de) +3 −4
8. [ ] [components/pages/TestConsole.js](https://github.com/umami-software/umami/pull/1376/files#diff-446657815eac8df844fa01296055dba718a47eb56fe21eab9f34b123631174c3) +2 −1
9. [ ] [db/mysql/schema.prisma](https://github.com/umami-software/umami/pull/1376/files#diff-31110ebf726faf3a7e9e7598bc6a44e9f8f9b81ecf49f9254e7e17ae87f43de1) +20 −13
10. [ ] [db/postgresql/schema.prisma](https://github.com/umami-software/umami/pull/1376/files#diff-6b6ebc176e32dab980ae88adc15c47193720a1903033f379980b14b5e6bcd858) +26 −19
11. [ ] [pages/api/website/[id]/events.js](https://github.com/umami-software/umami/pull/1376/files#diff-e1b094b920cad022b76b00098bf0214b1498c36fa447638ed20f666f8618332d) +2 −2
12. [ ] [pages/api/website/[id]/metrics.js](https://github.com/umami-software/umami/pull/1376/files#diff-766108f256716bdae836c5fd30732d916f18fa2dd3706434431ffc7c8ce832e4) +1 −1
13. [ ] [queries/analytics/event/getEventMetrics.js](https://github.com/umami-software/umami/pull/1376/files#diff-d2d1ff76092d4692981e48db3dd75a18b4ef5f5d09babf1ffe372ff2eb6374d3) +1 −1
14. [ ] [queries/analytics/event/getEvents.js](https://github.com/umami-software/umami/pull/1376/files#diff-8e50adf9b4315f84755a8a087d7bca0fa3700325cf8bfd1609f7883ab68cbd90) +1 −1
15. [ ] [scripts/check-db.js](https://github.com/umami-software/umami/pull/1376/files#diff-703a8fd9b77908e31a6a773cd2909e5cf7a945b6e0cc4dedfc43cfeebfd850e2) +6 −1
16. [ ] [tracker/index.js](https://github.com/umami-software/umami/pull/1376/files#diff-bdd0d205967e1b2ed4513d8b389b31cfc13e8f2aafcc40a18d007ef65df23752) +9 −9
