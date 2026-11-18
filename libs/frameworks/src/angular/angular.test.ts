import { adapterContext, MemorySnapshot } from "@ripple-review/core/snapshot";
import { describe, expect, it } from "vitest";
import { Angular } from "./angular.ts";

const component = [
  'import { Component, Directive, Input, Output, input, output, model } from "@angular/core";',
  "@Component({",
  '  selector: "app-line-actions",',
  '  templateUrl: "./list.component.html",',
  "  styleUrls: ['./list.component.scss', 'shared.css', './missing.css'],",
  "})",
  "export class ListComponent {",
  "  @Input() showTaxButton = false;",
  '  @Input("rowLabel") label = "";',
  "  @Output() taxRateClicked = new EventEmitter<void>();",
  "  selectedRows = input.required<Row[]>();",
  "  expandedChanged = output<boolean>();",
  "  pageSize = model(20);",
  "  plainField = 3;",
  "  helper() {}",
  "}",
  '@Directive({ selector: "[appTooltip], app-tip" })',
  "export class TooltipDirective { @Input() appTooltip = ''; }",
  "@Injectable({ templateUrl: './not-a-component.html' })",
  "export class NotAComponent { @Input() notBound = 1; }",
].join("\n");

const files: Record<string, string> = {
  "package.json": JSON.stringify({ name: "shop" }),
  "apps/web/package.json": JSON.stringify({
    dependencies: { "@angular/core": "21.0.0" },
  }),
  "apps/web/src/app/list.component.ts": component,
  "apps/web/src/app/list.component.html": "<p></p>",
  "apps/web/src/app/list.component.scss": "",
  "apps/web/src/app/shared.css": "",
  "apps/web/src/app/not-a-component.html": "",
};

async function rule(paths: Record<string, string> = files) {
  const r = new Angular();
  const found = await r.detect(await adapterContext(new MemorySnapshot(paths)));
  return { r, found };
}

const path = "apps/web/src/app/list.component.ts";

describe("Angular", () => {
  it("is detected by @angular/core in a package.json", async () => {
    expect((await rule()).found).toBe(true);
    const { "apps/web/package.json": _, ...withoutAngular } = files;
    expect((await rule(withoutAngular)).found).toBe(false);
  });

  it("reads a component's template and styles as its parts", async () => {
    const { r } = await rule();
    expect(r.file({ path, content: component })?.parts).toEqual([
      "apps/web/src/app/list.component.html",
      "apps/web/src/app/list.component.scss",
      "apps/web/src/app/shared.css",
    ]);
  });

  it("lists the template before the styles, in whatever order they're written", async () => {
    const { r } = await rule();
    const stylesFirst = [
      "@Component({",
      "  styleUrl: './list.component.scss',",
      "  templateUrl: 'list.component.html',",
      "})",
      "export class ListComponent {}",
    ].join("\n");
    expect(r.file({ path, content: stylesFirst })?.parts).toEqual([
      "apps/web/src/app/list.component.html",
      "apps/web/src/app/list.component.scss",
    ]);
  });

  it("defines the selectors, inputs and outputs templates bind to", async () => {
    const { r } = await rule();
    expect(r.file({ path, content: component })?.definitions).toEqual([
      "app-line-actions",
      "showTaxButton",
      "rowLabel",
      "taxRateClicked",
      "selectedRows",
      "expandedChanged",
      "pageSize",
      "appTooltip",
      "app-tip",
    ]);
  });

  it("defines a pipe's name, which templates use it by", async () => {
    const { r } = await rule();
    const pipe = [
      'import { Pipe, type PipeTransform } from "@angular/core";',
      '@Pipe({ name: "shortDate" })',
      "export class ShortDatePipe implements PipeTransform {",
      "  transform(v: string) { return v; }",
      "}",
    ].join("\n");
    expect(
      r.file({ path: "apps/web/src/app/short-date.pipe.ts", content: pipe })
        ?.definitions,
    ).toEqual(["shortDate"]);
  });

  it("leaves files without a component or directive alone", async () => {
    const { r } = await rule();
    expect(
      r.file({ path: "apps/web/src/app/x.ts", content: "export const x = 1;" }),
    ).toBeUndefined();
    expect(
      r.file({ path: "apps/web/src/app/x.html", content: "@Component" }),
    ).toBeUndefined();
  });
});
