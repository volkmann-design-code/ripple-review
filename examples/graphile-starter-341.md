# Review order: Upgrade TypeScript v4 -> v5, AntD v4 -> v5, Next v10 -> v13
https://github.com/graphile/starter/pull/341

53 files · +1778 −4159 · 13 groups · 5302 changed lines are generated

## 1. Context: read first
_1 files · +1 −1_

1. [ ] [README.md](https://github.com/graphile/starter/pull/341/files#diff-b335630551682c19a781afebcf4d07bf978fb1f8ac04c6bf87428ed5106870f5) +1 −1 · docs

## 2. Repository config
_4 files · +13 −6_

2. [ ] [.editorconfig](https://github.com/graphile/starter/pull/341/files#diff-0947e2727d6bad8cd0ac4122f5314bb5b04e337393075bc4b5ef143b17fcbd5b) +1 −1 · config
3. [ ] [.eslintrc.js](https://github.com/graphile/starter/pull/341/files#diff-e2954b558f2aa82baff0e30964490d12942e0e251c1aa56c3294de6ec67b7cf5) +7 −0 · config
4. [ ] [package.json](https://github.com/graphile/starter/pull/341/files#diff-7ae45ad102eab3b6d7e7896acd08c427a9b25b346470d7bc6507b6481575d519) +3 −2 · config
5. [ ] [tsconfig.json](https://github.com/graphile/starter/pull/341/files#diff-b55cdbef4907b7045f32cc5360d48d262cca5f94062e353089f189f4460039e0) +2 −3 · config

## 3. Around `styles.css` (@app/client)
_2 files · +24 −7_

6. [ ] [@app/client/src/styles.css](https://github.com/graphile/starter/pull/341/files#diff-ad9082f84d8c3ca3ef2ff131d03c4f2f53f95f5032b24d656e1b3ec3633f02b0) (renamed) +0 −0
7. [ ] [@app/client/src/pages/_app.tsx](https://github.com/graphile/starter/pull/341/files#diff-7fe4c73904cbb34567ce95d1eb6d6efaee13abe6cead3ad4d1b55e15ff729970) +24 −7 · imports styles.css

## 4. Around `handleErrors.ts` (@app/server)
_2 files · +27 −24_

8. [ ] [@app/server/src/utils/handleErrors.ts](https://github.com/graphile/starter/pull/341/files#diff-79661890356d8a46d17f4224250c351a1c86215557e2c77be6728449ab9575a5) +13 −10
9. [ ] [@app/server/src/plugins/PassportLoginPlugin.ts](https://github.com/graphile/starter/pull/341/files#diff-78c0077195b099ca1ba7416771ac4eab24429ee6b5f1dca1f73d6bb6ad906a7b) +14 −14 · uses `ERROR_MESSAGE_OVERRIDES` from handleErrors.ts

## 5. Around `SharedLayout.tsx`, `Redirect.tsx`, `errors.ts` (@app/components, @app/client, @app/lib)
_15 files · +164 −149_

10. [ ] [@app/components/src/Redirect.tsx](https://github.com/graphile/starter/pull/341/files#diff-1f32d6e057a0dccd2a4411caf0ae3dc7325d5713f087f82a25a5ad6677a1dc53) +2 −2
11. [ ] [@app/components/src/SharedLayout.tsx](https://github.com/graphile/starter/pull/341/files#diff-c2c33c45434fa05856067678d39d0e4bb1b6ec97a130a091ae6dde99f4fea372) +31 −32 · uses `Redirect` from Redirect.tsx
12. [ ] [@app/client/src/pages/index.tsx](https://github.com/graphile/starter/pull/341/files#diff-171572f2634ad34dc10fd74b8c8d70d4db75f083adcce36bbb63d160e172352d) +39 −34 · uses `SharedLayout` from SharedLayout.tsx
13. [ ] [@app/client/src/pages/o/[slug]/index.tsx](https://github.com/graphile/starter/pull/341/files#diff-33645f3376649590b98a1010fcc4a22de5f0c1623e02b6434ad56c1550d2091f) +2 −1 · uses `SharedLayout` from SharedLayout.tsx
14. [ ] [@app/client/src/pages/reset.tsx](https://github.com/graphile/starter/pull/341/files#diff-d751e9a752f22951d3401cf4fad880cd979a3956d8eff40466bbefa716833875) +1 −1 · uses `AuthRestrict`, `Col`, `Row` from SharedLayout.tsx
15. [ ] [@app/client/src/pages/verify.tsx](https://github.com/graphile/starter/pull/341/files#diff-ffd40541967843d2256ad27739aca6467675ab1f731ff999d6ac579b4c742954) +1 −1 · uses `Col`, `Row`, `SharedLayout` from SharedLayout.tsx
16. [ ] [@app/lib/src/errors.ts](https://github.com/graphile/starter/pull/341/files#diff-e6ee270420e251a05b4afc90f48def158719955b0cd88ff2a0c5a510cb9662dd) +9 −3
17. [ ] [@app/client/src/pages/create-organization/index.tsx](https://github.com/graphile/starter/pull/341/files#diff-8c3f29925df367ec814a3d20d816a51ae56517243ae290fa11ae7607bb3ff84d) +2 −1 · uses `AuthRestrict`, `SharedLayout` from SharedLayout.tsx; uses `extractError`, `getCodeFromError` from errors.ts; +1 more
18. [ ] [@app/client/src/pages/login.tsx](https://github.com/graphile/starter/pull/341/files#diff-cfe5e1d22cbf3129a87071bc70a7c3b2b7ee4f997ba0c3774ab95aed3191181c) +10 −12 · uses `AuthRestrict`, `Col`, `Row` from SharedLayout.tsx; uses `extractError`, `getCodeFromError` from errors.ts; +1 more
19. [ ] [@app/client/src/pages/register.tsx](https://github.com/graphile/starter/pull/341/files#diff-2dadc5d533cfe05ad3d58003d2c52cd8dc0bca22435e34a76cb5aecdd4c695fb) +2 −2 · uses `extractError`, `getCodeFromError`, `getExceptionFromError` from errors.ts; uses `AuthRestrict`, `SharedLayout` from SharedLayout.tsx; +2 more
20. [ ] [@app/lib/src/GraphileApolloLink.client.ts](https://github.com/graphile/starter/pull/341/files#diff-b7b13595db24f78809a1c759b0d757141126cbfe592623f78e44bfe4d4e15d5b) (new) +7 −0
21. [ ] [@app/lib/src/index.tsx](https://github.com/graphile/starter/pull/341/files#diff-e81cd393df5a44e538181837e7ce5a825fec9a3c1d87e9db6fdb7a2969fda873) +0 −1 · wiring · re-exports errors.ts; re-exports GraphileApolloLink.client.ts
22. [ ] [@app/client/package.json](https://github.com/graphile/starter/pull/341/files#diff-e470c567065a87d4426486b7376675b00834d548e7fb90ea422f79b877d03094) +10 −15 · config
23. [ ] [@app/client/src/next.config.js](https://github.com/graphile/starter/pull/341/files#diff-8fab28d80723f434b303825229f2d42df3e5fb2699748476828c127a08c3008b) +20 −36 · config · mentions `GraphileApolloLink` from GraphileApolloLink.client.ts
24. [ ] [@app/client/src/tsconfig.json](https://github.com/graphile/starter/pull/341/files#diff-725dd59e7e80f1c6da6520b52b914578f0ef76c84c6a17203b593792f597514e) +28 −8 · config

## 6. Around `ErrorOccurred.tsx` (@app/components, @app/client)
_2 files · +7 −13_

25. [ ] [@app/components/src/ErrorOccurred.tsx](https://github.com/graphile/starter/pull/341/files#diff-be78d3adf4bad3137088817883ab89d728c7b4df8568951c86f52ac83227cb7e) +3 −5
26. [ ] [@app/client/src/pages/_error.tsx](https://github.com/graphile/starter/pull/341/files#diff-35361af35de604d31a44459fcc4471b6797087a4d883bd06043575b48b5bb6cf) +4 −8 · uses `ErrorOccurred` from ErrorOccurred.tsx; uses `SharedLayout` from SharedLayout.tsx

## 7. Around `ErrorAlert.tsx`, `SettingsLayout.tsx` (@app/components, @app/client)
_6 files · +40 −36_

27. [ ] [@app/components/src/ErrorAlert.tsx](https://github.com/graphile/starter/pull/341/files#diff-9e062124fecc8c51f571be0509cd01dfa1344c116311a556d15eb2ff296468a0) +2 −1
28. [ ] [@app/components/src/SettingsLayout.tsx](https://github.com/graphile/starter/pull/341/files#diff-435e0b88bc99b102216413f1628751a1223c2ed77e14f9c44d6d7d732ff7652c) +9 −9 · uses `AuthRestrict`, `contentMinHeight`, `SharedLayout` from SharedLayout.tsx; uses `Redirect` from Redirect.tsx
29. [ ] [@app/client/src/pages/settings/accounts.tsx](https://github.com/graphile/starter/pull/341/files#diff-ace0ee94800950b30ab7cd5348008462fc345c89295dcea76468d8d9d2640b33) +7 −6 · uses `ErrorAlert` from ErrorAlert.tsx; uses `SettingsLayout` from SettingsLayout.tsx
30. [ ] [@app/client/src/pages/settings/delete.tsx](https://github.com/graphile/starter/pull/341/files#diff-d132fa4a025e6f19c46abf641fe5812f9ba73fb369fa07a5caad331029ce77b4) +14 −14 · uses `ErrorAlert` from ErrorAlert.tsx; uses `SettingsLayout` from SettingsLayout.tsx; +1 more
31. [ ] [@app/client/src/pages/settings/emails.tsx](https://github.com/graphile/starter/pull/341/files#diff-2d900496155e56ad2870ff91569766371892a65511f5837852f1808537d7d5e9) +2 −1 · uses `extractError`, `getCodeFromError` from errors.ts; uses `ErrorAlert` from ErrorAlert.tsx; +2 more
32. [ ] [@app/client/src/pages/settings/security.tsx](https://github.com/graphile/starter/pull/341/files#diff-0f723ac587450d65b1747296e55631aeefb5e347a393d25035bd77d2a0705e72) +6 −5 · uses `extractError`, `getCodeFromError` from errors.ts; uses `ErrorAlert` from ErrorAlert.tsx; +1 more

## 8. Around `OrganizationSettingsLayout.tsx` (@app/components, @app/client)
_3 files · +12 −9_

33. [ ] [@app/components/src/OrganizationSettingsLayout.tsx](https://github.com/graphile/starter/pull/341/files#diff-b79d1a557c8ec557ed44aacb36f2759227d9a1e74bb40c46bada6b2be983388b) +8 −7 · uses `contentMinHeight` from SharedLayout.tsx
34. [ ] [@app/client/src/pages/o/[slug]/settings/delete.tsx](https://github.com/graphile/starter/pull/341/files#diff-9ccb4cff069b77c5baf998689df4e18b5faaa14cdee6f12dcdfa75e12246435c) +2 −1 · uses `AuthRestrict`, `SharedLayout` from SharedLayout.tsx; uses `ErrorAlert` from ErrorAlert.tsx; +1 more
35. [ ] [@app/client/src/pages/o/[slug]/settings/index.tsx](https://github.com/graphile/starter/pull/341/files#diff-5d29b2ab9966c452fad79d98167fdaf6cc817cbfaa6e5b4549bde215e208b298) +2 −1 · uses `AuthRestrict`, `SharedLayout` from SharedLayout.tsx; uses `OrganizationSettingsLayout` from OrganizationSettingsLayout.tsx; +2 more

## 9. Same edit in 3 files: `+import { Alert, Button, Form, Input } from "antd";` `+import { PageHeader } from "@ant-design/pro-layout";`
_3 files · +6 −6_

36. [ ] [@app/client/src/pages/forgot.tsx](https://github.com/graphile/starter/pull/341/files#diff-23cca98245e2254076d492129f2b1402f0c818e9fc32918b218f5744acab9832) +3 −4
37. [ ] [@app/client/src/pages/o/[slug]/settings/members.tsx](https://github.com/graphile/starter/pull/341/files#diff-b2c9dfa146c172c1b04451f92df7d60268f8441416379446df55011c6c7c3ab0) +1 −1
38. [ ] [@app/client/src/pages/settings/index.tsx](https://github.com/graphile/starter/pull/341/files#diff-aba1fa4edb6c983a9e8cc7856764c24a1e9e4c842d72c39833a36494948de87e) +2 −1

## 10. Same edit in 4 files: `-"react": "^17.0.2",` `-"next": "^10.2.3",` `-"@apollo/client": "^3.7.9",`
_4 files · +14 −14_

39. [ ] [@app/components/package.json](https://github.com/graphile/starter/pull/341/files#diff-68fb7289b190a430475d03fb5ee8a2f3464f1c9424a784954ae40dc7f78fe5a2) +6 −6 · config
40. [ ] [@app/graphql/package.json](https://github.com/graphile/starter/pull/341/files#diff-e9f08208f99b959d70d2bd130f273e0c0d67a92e747ef8f418ccbdf614bd5c8c) +2 −2 · config
41. [ ] [@app/lib/package.json](https://github.com/graphile/starter/pull/341/files#diff-815bc29649aa2009c9310dd47b764ef35e1ac458db1f95b348dd9bc8a720aaeb) +5 −5 · config
42. [ ] [@app/server/package.json](https://github.com/graphile/starter/pull/341/files#diff-4d9dcba5ac9d6ff289f43bb2d43a246a736253e759cc406ed5b44c7ea671e9b2) +1 −1 · config

## 11. Standalone changes
_7 files · +27 −23_

43. [ ] [@app/client/src/next-env.d.ts](https://github.com/graphile/starter/pull/341/files#diff-588eb4939211232a3454debcca09ed7904518bf5e4dc436df15413dbc407a110) +4 −1 · contract
44. [ ] [@app/client/assets/antd-custom.less](https://github.com/graphile/starter/pull/341/files#diff-33693f19a2cbe4f6dd89b3419c5b4bb22712fa89077e7e658a05ed1e5f9b864e) (deleted) +0 −12
45. [ ] [@app/client/src/pages/_document.tsx](https://github.com/graphile/starter/pull/341/files#diff-6e05bd07f5df94b8e36b625aac3f2bb5799270a38eaa95896efb2a28eb997a34) +4 −0
46. [ ] [@app/server/src/middleware/installErrorHandler.ts](https://github.com/graphile/starter/pull/341/files#diff-38978ca2b84de16cdeaa3ae777a3644dddf4417fba86497d4b001529e38e0c62) +9 −2
47. [ ] [@app/server/src/middleware/installPassportStrategy.ts](https://github.com/graphile/starter/pull/341/files#diff-a240cfeba38f09e10790959f1b903eee6b9daf4515d8b2e5597f4578e2482e39) +6 −6
48. [ ] [@app/worker/src/tasks/send_email.ts](https://github.com/graphile/starter/pull/341/files#diff-d702fd25dcb4ca8eab53f5aafe890be5f035758466d83679d314795d4d49c5e5) +4 −1
49. [ ] [production.Dockerfile](https://github.com/graphile/starter/pull/341/files#diff-55d06c59f3552514747959fc163ad2940d33f0757fa48cf363580af437dee6a3) +0 −1

## 12. Tests in `@app`
_3 files · +6 −6_

50. [ ] [@app/e2e/cypress/integration/organization_create.spec.ts](https://github.com/graphile/starter/pull/341/files#diff-0919c2c3c535ec5b2c6003a1c052019ce6c9dcf1bb7ad7d69ffe1594476db48d) +1 −1 · test
51. [ ] [@app/e2e/cypress/integration/organization_page.spec.ts](https://github.com/graphile/starter/pull/341/files#diff-5a90a7dd210bdbe1ea8b8900de901c916030ec6bc5f871631a60936a9db7b14b) +2 −2 · test
52. [ ] [@app/e2e/package.json](https://github.com/graphile/starter/pull/341/files#diff-0407efab4c6012657791bb73bdc2dd86cfc672148fc6ebd7c922fbe564d50155) +3 −3 · test

## 13. Generated: check it matches its source, don't review line by line
_1 files · +1437 −3865_

53. [ ] [yarn.lock](https://github.com/graphile/starter/pull/341/files#diff-51e4f558fae534656963876761c95b83b6ef5da5103c4adef6768219ed76c2de) +1437 −3865 · lockfile
