import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { ReviewPayload } from "@ripple-review/api-contract";
import { IconComponent } from "../../ui/icon.component";
import { basename } from "../format";

type AiInfo = NonNullable<ReviewPayload["ai"]>;

/** Which model refined the order, what it cost, and the links it calls weak. */
@Component({
  selector: "rr-ai-summary",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-md border border-teal-200 bg-teal-50 px-4 py-2 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200">
      <p class="flex flex-wrap items-center gap-1">
        <rr-icon name="ai" size="sm" />
        Refined by {{ ai().model }}
        @if (ai().usage; as u) {
          · {{ u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens }} tokens in, {{ u.outputTokens }} out
          @if (u.costUsd !== undefined) {
            · ~{{ u.costUsd.toFixed(3) }} USD
          }
        } @else {
          · answer saved on this device, no new cost
        }
      </p>
      @if (ai().weakEdges.length) {
        <details class="mt-1">
          <summary class="cursor-pointer">{{ ai().weakEdges.length }} weak links</summary>
          <ul class="mt-1 list-disc pl-5">
            @for (e of ai().weakEdges; track e.from + e.to) {
              <li><code>{{ basename(e.from) }}</code> → <code>{{ basename(e.to) }}</code>: {{ e.reason }}</li>
            }
          </ul>
        </details>
      }
    </div>
  `,
})
export class AiSummaryComponent {
  readonly ai = input.required<AiInfo>();
  protected readonly basename = basename;
}
