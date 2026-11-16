import {
  DestroyRef,
  Directive,
  ElementRef,
  Injectable,
  inject,
  input,
  type OnInit,
  signal,
} from "@angular/core";

/** What a watched element is: a group, or a file in a group. */
export interface SpyTarget {
  group: string;
  file?: string;
}

/** How much of a file is seen, in steps: 1 (a sliver) to 4 (all of it, or the whole screen). */
export type SeenLevel = 1 | 2 | 3 | 4;

/**
 * The groups and files on screen: any part of them visible below the sticky
 * headers (the app header and review bar; for files, the group header too),
 * and for files how much. Watched elements register through `[rrSpy]`.
 */
@Injectable()
export class ScrollSpy {
  /** Ids of the groups on screen. */
  readonly groups = signal<ReadonlySet<string>>(new Set());
  /** The files on screen (paths), with how much of each is seen. */
  readonly files = signal<ReadonlyMap<string, SeenLevel>>(new Map());

  private readonly targets = new Map<Element, SpyTarget>();
  private readonly onScreen = new Set<Element>();
  private groupObserver?: IntersectionObserver;
  private fileObserver?: IntersectionObserver;
  private fileTop = 0;
  private frame = 0;

  constructor() {
    // The observers say what enters and leaves; how much is seen changes
    // with every scroll, so it is measured then (once a frame).
    const measure = () => {
      if (!this.frame) {
        this.frame = requestAnimationFrame(() => {
          this.frame = 0;
          this.publish();
        });
      }
    };
    addEventListener("scroll", measure, { passive: true });
    addEventListener("resize", measure);
    inject(DestroyRef).onDestroy(() => {
      removeEventListener("scroll", measure);
      removeEventListener("resize", measure);
      cancelAnimationFrame(this.frame);
      this.disconnect();
    });
  }

  /**
   * Watches what is visible below `groupTop` (px from the top of the
   * window) for groups, and below `fileTop` for files.
   */
  observe(groupTop: number, fileTop: number): void {
    this.disconnect();
    this.fileTop = fileTop;
    const watch = (top: number) =>
      new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              this.onScreen.add(e.target);
            } else {
              this.onScreen.delete(e.target);
            }
          }
          this.publish();
        },
        { rootMargin: `-${top}px 0px 0px 0px` },
      );
    this.groupObserver = watch(groupTop);
    this.fileObserver = watch(fileTop);
    for (const [el, t] of this.targets) {
      this.observerOf(t)?.observe(el);
    }
  }

  add(el: Element, target: SpyTarget): void {
    this.targets.set(el, target);
    this.observerOf(target)?.observe(el);
  }

  remove(el: Element): void {
    const t = this.targets.get(el);
    this.targets.delete(el);
    if (t) {
      this.observerOf(t)?.unobserve(el);
    }
    if (this.onScreen.delete(el)) {
      this.publish();
    }
  }

  private observerOf(t: SpyTarget): IntersectionObserver | undefined {
    return t.file ? this.fileObserver : this.groupObserver;
  }

  private publish(): void {
    const groups = new Set<string>();
    const files = new Map<string, SeenLevel>();
    for (const el of this.onScreen) {
      const t = this.targets.get(el);
      if (t?.file) {
        files.set(t.file, this.seen(el));
      } else if (t) {
        groups.add(t.group);
      }
    }
    if (!sameSet(groups, this.groups())) {
      this.groups.set(groups);
    }
    if (!sameMap(files, this.files())) {
      this.files.set(files);
    }
  }

  /** The more of the file, or of the screen, it fills. */
  private seen(el: Element): SeenLevel {
    const r = el.getBoundingClientRect();
    const screen = Math.max(1, innerHeight - this.fileTop);
    const visible = Math.max(
      0,
      Math.min(r.bottom, innerHeight) - Math.max(r.top, this.fileTop),
    );
    const share = Math.max(visible / Math.max(1, r.height), visible / screen);
    return Math.min(4, Math.max(1, Math.ceil(share * 4 - 0.05))) as SeenLevel;
  }

  private disconnect(): void {
    this.groupObserver?.disconnect();
    this.fileObserver?.disconnect();
    this.onScreen.clear();
  }
}

function sameSet<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function sameMap<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): boolean {
  return a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
}

/** Has the page's `ScrollSpy` watch this element (none on the page: nothing). */
@Directive({ selector: "[rrSpy]" })
export class SpyDirective implements OnInit {
  readonly rrSpy = input.required<SpyTarget>();
  private readonly spy = inject(ScrollSpy, { optional: true });
  private readonly el = inject<ElementRef<Element>>(ElementRef).nativeElement;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.spy?.remove(this.el));
  }

  ngOnInit(): void {
    this.spy?.add(this.el, this.rrSpy());
  }
}
