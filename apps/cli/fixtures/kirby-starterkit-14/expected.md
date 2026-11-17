# Review order: Texnixe/suggestions
https://github.com/getkirby/starterkit/pull/14

10 files · +38 −10 · 4 groups

## 1. Around `note.yml` (site/blueprints, site/templates)
_2 files · +6 −3_

1. [ ] [site/blueprints/pages/note.yml](https://github.com/getkirby/starterkit/pull/14/files#diff-856c964f30e9115a409d63f5650e092a582815d7b77533877cc82b719a64794f) +3 −0 · schema
2. [ ] [site/templates/note.php](https://github.com/getkirby/starterkit/pull/14/files#diff-edab85de4925baaa93a32d1f3cad60afbb7589f66584d120464349cdb108ff98) +3 −3 · template of note.yml (Kirby)

## 2. Around `image.yml`, `album.yml` (site/blueprints)
_3 files · +16 −3_

3. [ ] [site/blueprints/files/image.yml](https://github.com/getkirby/starterkit/pull/14/files#diff-b8bf595c1254b73b9f3065c151f9bbfb1576255df4c816469986972d9cb9da29) +4 −0 · schema
4. [ ] [site/blueprints/pages/album.yml](https://github.com/getkirby/starterkit/pull/14/files#diff-e998340da01a2ac4cc0833488bb1ecf736cf23411c684fc0c3c4588ef5f4fa07) +3 −3 · schema · uses the template image.yml (Kirby)
5. [ ] [site/blueprints/fields/cover.yml](https://github.com/getkirby/starterkit/pull/14/files#diff-62ff1f1046128302d11b023460e27f7eaee8062b9a2a51a4b91582dfb5c08854) (new) +9 −0 · schema · included by album.yml; included by note.yml; +1 more

## 3. Around `default.php`, `home.php` (site/templates, site/snippets)
_3 files · +3 −3_

6. [ ] [site/templates/default.php](https://github.com/getkirby/starterkit/pull/14/files#diff-f0e610d5716ab5019bf5c955a17708f9d55f388dd1d9fa958642687436e34421) +1 −1
7. [ ] [site/templates/home.php](https://github.com/getkirby/starterkit/pull/14/files#diff-1ad9bd98f7014d46d0e864e0ee7501893f9631acc4c577cff177d553ff80d06a) +1 −1
8. [ ] [site/snippets/header.php](https://github.com/getkirby/starterkit/pull/14/files#diff-74016483b2797f7c84a31605ab1c3fd559703cbccd00c58f52dc0f65a60f7c20) +1 −1 · included by default.php; included by home.php; +1 more

## 4. Around `notes.php` (site/collections, site/controllers)
_2 files · +13 −1_

9. [ ] [site/collections/notes.php](https://github.com/getkirby/starterkit/pull/14/files#diff-304ead388d2dbd82870ac2ca3579bdb2ce4c3eb65ee7b36214eb152334f9ffed) +7 −1
10. [ ] [site/controllers/notes.php](https://github.com/getkirby/starterkit/pull/14/files#diff-eb5f02e64e804fc78d883380ed4c833cca02225941e76c6873f455b647c1d911) +6 −0 · uses the collection notes.php (Kirby)
