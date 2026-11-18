# Review order: feat(switch): turn brn-switch-thumb into directive, add forceInvalid to brn-switch
https://github.com/spartan-ng/spartan/pull/1741

16 files · +230 −51 · 3 groups

## 1. Around `brn-switch-thumb.ts`, `brn-switch.ts`, `hlm-switch-thumb.ts` (libs/brain, libs/helm, libs/cli +1)
_8 files · +56 −25_

1. [ ] [libs/brain/switch/src/lib/brn-switch.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-561dd0a0b070fa22007eb45da57326d73f6f2e603f842995fd53c88ae21a8445) +6 −3
2. [ ] [libs/brain/switch/src/lib/brn-switch-thumb.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-f606fa0aa1bd73447e09dd915799526b8bd4482ac0d8db519a90ec9ff9b47ac6) +3 −5 · uses `BrnSwitch` from brn-switch.ts
3. [ ] [libs/helm/switch/src/lib/hlm-switch-thumb.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-e67830c781bdbd673a5ea7ffb15269f564310aa8f12b150eb9824bddf988894c) +3 −1 · uses `BrnSwitchThumb` from brn-switch-thumb.ts
4. [ ] [libs/cli/src/generators/ui/libs/switch/files/lib/hlm-switch-thumb.ts.template](https://github.com/spartan-ng/spartan/pull/1741/files#diff-21d3cd048b24f42e223fd46486176ca1e2cea8b82744023c3c6b0aac97436451) +3 −1 · mentions `hlmSwitchThumb`, `hlm-switch-thumb` from hlm-switch-thumb.ts (Angular); mentions `BrnSwitchThumb` from brn-switch-thumb.ts
5. [ ] [libs/helm/switch/src/lib/hlm-switch.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-d412041e51d9961add28dd35363e4e51afe494caf88b735d5157c48f8fb43220) +10 −6 · uses `BrnSwitch`, `BrnSwitchSize` from brn-switch.ts; uses `HlmSwitchThumb` from hlm-switch-thumb.ts; +1 more
6. [ ] [libs/cli/src/generators/ui/libs/switch/files/lib/hlm-switch.ts.template](https://github.com/spartan-ng/spartan/pull/1741/files#diff-eafb0c6b2218868814cf49d96a86d3c93ccccb8f3c02b1882f114c7a4baa76dd) +10 −6 · mentions `BrnSwitch`, `BrnSwitchSize`, `forceInvalid` from brn-switch.ts; mentions `HlmSwitchThumb`, `hlm-switch-thumb` from hlm-switch-thumb.ts; +2 more
7. [ ] [libs/tools/src/executors/docs/generate-ui-docs/__snapshots__/executor.spec.ts.snap](https://github.com/spartan-ng/spartan/pull/1741/files#diff-368dc3f1663e44012ae4265a30b432ffd214564bced24e36bba81efff8db3a25) +12 −2 · test-support · mentions `hlmSwitchThumb`, `hlm-switch-thumb` from hlm-switch-thumb.ts (Angular); mentions `forceInvalid` from brn-switch.ts (Angular); +2 more
8. [ ] [libs/brain/switch/src/lib/brn-switch-ng-model.spec.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-b6fff0bc23c2088671358842ca128a0d359820bca067e5327a9bed0d374f3d88) +9 −1 · test · uses `BrnSwitch` from brn-switch.ts; uses `BrnSwitchThumb` from brn-switch-thumb.ts

## 2. Around `switch--rtl.example.ts`, `switch--choice-card.example.ts`, `switch--description.example.ts` (apps/app)
_7 files · +173 −25_

9. [ ] [apps/app/src/app/pages/(components)/components/(switch)/switch--choice-card.example.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-a3b200831b5b2a7264ef7ce61a004ee024042179900ba0af7f0d9e2943c30b5c) (new) +32 −0 · uses `HlmSwitch` from hlm-switch.ts
10. [ ] [apps/app/src/app/pages/(components)/components/(switch)/switch--description.example.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-39d914d3f4c525997cc511b848be9a4c2b703d90d3967693ee96cb372efb59b5) (new) +18 −0 · uses `HlmSwitch` from hlm-switch.ts
11. [ ] [apps/app/src/app/pages/(components)/components/(switch)/switch--disabled.example.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-3b38bd0c81b68be3594530ab3648273ce113ccda1e406291fb2157fcc8975413) (new) +15 −0 · uses `HlmSwitch` from hlm-switch.ts
12. [ ] [apps/app/src/app/pages/(components)/components/(switch)/switch--invalid.example.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-1888be422a763385d00617ee5ec89ab9a89260c7a62521ec3061081fa0aa2681) (new) +18 −0 · uses `HlmSwitch` from hlm-switch.ts; mentions `forceInvalid` from brn-switch.ts (Angular)
13. [ ] [apps/app/src/app/pages/(components)/components/(switch)/switch--rtl.example.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-76dac6f189b7d02832fc07e4447db81bc643315553de81f32638f6811bfc8d84) +30 −9 · uses `HlmSwitch` from hlm-switch.ts; mentions `airplaneMode` from brn-switch-ng-model.spec.ts (Angular)
14. [ ] [apps/app/src/app/pages/(components)/components/(switch)/switch--sizes.example.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-5a0c10c02d948ad8dd80d984b89e4cf87ec7146354948586615bb4e07c7f0f69) +13 −13 · uses `HlmSwitch` from hlm-switch.ts
15. [ ] [apps/app/src/app/pages/(components)/components/(switch)/switch.page.ts](https://github.com/spartan-ng/spartan/pull/1741/files#diff-864f1da1f1d321741d3d676e166ecb32e4db4bde926ad42aeebf082c256168c1) +47 −3 · needed by 2 later files; uses `SwitchRtlPreview` from switch--rtl.example.ts; uses `SwitchChoiceCard` from switch--choice-card.example.ts; +4 more

## 3. Standalone changes
_1 files · +1 −1_

16. [ ] [libs/cli/src/generators/ui/supported-ui-libraries.json](https://github.com/spartan-ng/spartan/pull/1741/files#diff-8003fe65f544054216a99746d776622319ded203f374dc014e7d387fdecdf243) +1 −1
