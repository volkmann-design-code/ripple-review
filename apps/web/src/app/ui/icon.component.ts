import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { ICONS, type IconName } from "./icons";

const SIZES = { xs: 14, sm: 16, md: 20, lg: 24 } as const;

/**
 * An icon, decorative: it takes the text colour and is hidden from assistive
 * technology; the control's label says what it stands for.
 */
@Component({
  selector: "rr-icon",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="block"
      [attr.viewBox]="glyph().viewBox"
      [attr.width]="px()"
      [attr.height]="px()"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="glyph().d" fill="currentColor" />
    </svg>
  `,
  host: { class: "inline-flex shrink-0 items-center justify-center" },
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<keyof typeof SIZES>("md");
  protected readonly glyph = computed(() => ICONS[this.name()]);
  protected readonly px = computed(() => SIZES[this.size()]);
}
