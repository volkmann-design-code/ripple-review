# Review order: fix(reg-exp-router): correct wildcard middleware coverage
https://github.com/honojs/hono/pull/5556

10 files · +423 −140 · 4 groups

## 1. Around `node.ts` (src/router)
_3 files · +14 −24_

1. [ ] [src/router/reg-exp-router/node.ts](https://github.com/honojs/hono/pull/5556/files#diff-910086716af3bb65f3795eca9577808516883ac0f0ddab739599bddc4242b55b) +7 −5
2. [ ] [src/router/reg-exp-router/trie.ts](https://github.com/honojs/hono/pull/5556/files#diff-a700e713959564ec86d1d69442497387611141942a7f2118bba199abf86422b2) +7 −5 · uses `Context`, `ParamAssocArray`, `Node` from node.ts
3. [ ] [src/router/reg-exp-router/router.test.ts](https://github.com/honojs/hono/pull/5556/files#diff-9c118fa74a63028640569d2d36dc3980faa196b86b3a706dc1c1c211931e8639) +0 −14 · test · uses `ONLY_WILDCARD_REG_EXP_STR`, `TAIL_WILDCARD_REG_EXP_STR` from node.ts

## 2. Around `prepared-router.ts`, `router.ts` (src/router)
_3 files · +113 −94_

4. [ ] [src/router/reg-exp-router/router.ts](https://github.com/honojs/hono/pull/5556/files#diff-06f981941f95eecd6e249629fd9d5d4badaf8dfbe96ade6219e67691359df679) +61 −88 · uses `ONLY_WILDCARD_REG_EXP_STR`, `PATH_ERROR`, `PREFIXED_WILDCARD_REG_EXP_STR` from node.ts; uses `Trie` from trie.ts
5. [ ] [src/router/reg-exp-router/prepared-router.ts](https://github.com/honojs/hono/pull/5556/files#diff-05f98af8ac89c7dd686b79c41d8167478c790c0051245d79c3b0f0554351dc63) +7 −6 · uses `RegExpRouter` from router.ts
6. [ ] [src/router/reg-exp-router/prepared-router.test.ts](https://github.com/honojs/hono/pull/5556/files#diff-1a5aa7fd77bf458676cd0952efb26262288e9d147c54b4cad3620115ed648997) +45 −0 · test · uses `buildInitParams`, `serializeInitParams`, `PreparedRegExpRouter` from prepared-router.ts

## 3. Around `router.ts` (src/router)
_3 files · +285 −8_

7. [ ] [src/router/linear-router/router.ts](https://github.com/honojs/hono/pull/5556/files#diff-d2b6b18f82ec3cc72a4d6cb0e08670d9b62344f66dfb335d4bb39f7d5bb2c8b2) +12 −7
8. [ ] [src/router/common.case.test.ts](https://github.com/honojs/hono/pull/5556/files#diff-18f50c43f41503d5cc65c9d783b57e0c683eb26957f59a11edb2d099f40114c2) +260 −1 · test · needed by 2 later files
9. [ ] [src/router/linear-router/router.test.ts](https://github.com/honojs/hono/pull/5556/files#diff-635018449305bfae5d725a28847813e3b418d934b79a0f51894a8c90bcf6bf9d) +13 −0 · test · uses `runTest` from common.case.test.ts; uses `LinearRouter` from router.ts

## 4. Standalone changes
_1 files · +11 −14_

10. [ ] [src/router/trie-router/node.ts](https://github.com/honojs/hono/pull/5556/files#diff-bf1549ba9405f87c376d2d338883f54bfeb6a91f40b28e62dd2ce5e9d4edd4e5) +11 −14
