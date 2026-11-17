# Review order: feat(tooltip): add sideOffset input
https://github.com/spartan-ng/spartan/pull/1845

8 files · +205 −16 · 2 groups

## 1. Around `brn-tooltip-position.ts`, `brn-tooltip.token.ts`, `hlm-tooltip.ts` (libs/brain, libs/helm, libs/cli)
_7 files · +195 −16_

1. [ ] [libs/brain/tooltip/src/lib/brn-tooltip-position.ts](https://github.com/spartan-ng/spartan/pull/1845/files#diff-c11bc1149ddee5617d4f7144005755d0fe367445fece578a3f0c2bce26d8e0c9) +13 −4
2. [ ] [libs/brain/tooltip/src/lib/brn-tooltip.token.ts](https://github.com/spartan-ng/spartan/pull/1845/files#diff-f05fe24600133e9f06e62d5ab4598d8bbb8ef61dc7872f20124217bb3d763634) +3 −0 · uses `BrnTooltipPosition` from brn-tooltip-position.ts
3. [ ] [libs/brain/tooltip/src/lib/brn-tooltip.ts](https://github.com/spartan-ng/spartan/pull/1845/files#diff-50f6dd1bc8b12aec03615f69df78322293982f65b9440efd712096bdd61d6784) +22 −10 · uses `BRN_TOOLTIP_FALLBACK_POSITIONS`, `BRN_TOOLTIP_POSITIONS_MAP`, `BrnTooltipPosition` from brn-tooltip-position.ts; uses `injectBrnTooltipDefaultOptions` from brn-tooltip.token.ts
4. [ ] [libs/helm/tooltip/src/lib/hlm-tooltip.ts](https://github.com/spartan-ng/spartan/pull/1845/files#diff-0860108d00bcc62211c99dc46166100e9f583b83300168a1e1b9beea1b07cacb) +1 −1 · uses `BrnTooltip` from brn-tooltip.ts; uses `BrnTooltipPosition` from brn-tooltip-position.ts; +1 more
5. [ ] [libs/cli/src/generators/ui/libs/tooltip/files/lib/hlm-tooltip.ts.template](https://github.com/spartan-ng/spartan/pull/1845/files#diff-8c649d16aa07c887334236f0389e4202184025cb209559e15845909b0cf7b3b2) +1 −1 · mentions `brnTooltip`, `hideDelay`, `showDelay` from brn-tooltip.ts (Angular); mentions `hlmTooltip` from hlm-tooltip.ts (Angular)
6. [ ] [libs/brain/tooltip/src/lib/brn-tooltip-position.spec.ts](https://github.com/spartan-ng/spartan/pull/1845/files#diff-0ec7cf0a6383689dab2846c18fc1edda541669f8499d0119b8cd687f0dd321bf) (new) +15 −0 · test · uses `getTooltipSideOffset` from brn-tooltip-position.ts
7. [ ] [libs/helm/tooltip/src/lib/hlm-tooltip-side-offset.spec.ts](https://github.com/spartan-ng/spartan/pull/1845/files#diff-91f2be9022fa740c41f51ab3b4156773affd578225f8a13e10a323900b4826ee) (new) +140 −0 · test · uses `provideBrnTooltipDefaultOptions` from brn-tooltip.token.ts; uses `HlmTooltip` from hlm-tooltip.ts

## 2. Standalone changes
_1 files · +10 −0_

8. [ ] [libs/tools/src/executors/docs/generate-ui-docs/__snapshots__/executor.spec.ts.snap](https://github.com/spartan-ng/spartan/pull/1845/files#diff-368dc3f1663e44012ae4265a30b432ffd214564bced24e36bba81efff8db3a25) +10 −0 · test-support
