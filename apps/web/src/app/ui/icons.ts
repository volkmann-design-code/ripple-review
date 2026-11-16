import add from "@material-symbols/svg-400/rounded/add.svg";
import addComment from "@material-symbols/svg-400/rounded/add_comment.svg";
import chatBubble from "@material-symbols/svg-400/rounded/chat_bubble.svg";
import checkCircle from "@material-symbols/svg-400/rounded/check_circle.svg";
import cloudDone from "@material-symbols/svg-400/rounded/cloud_done.svg";
import code from "@material-symbols/svg-400/rounded/code.svg";
import deleteIcon from "@material-symbols/svg-400/rounded/delete.svg";
import devices from "@material-symbols/svg-400/rounded/devices.svg";
import doneAll from "@material-symbols/svg-400/rounded/done_all.svg";
import edit from "@material-symbols/svg-400/rounded/edit.svg";
import error from "@material-symbols/svg-400/rounded/error.svg";
import key from "@material-symbols/svg-400/rounded/key.svg";
import arrowDown from "@material-symbols/svg-400/rounded/keyboard_arrow_down.svg";
import arrowRight from "@material-symbols/svg-400/rounded/keyboard_arrow_right.svg";
import expandDown from "@material-symbols/svg-400/rounded/keyboard_double_arrow_down.svg";
import expandUp from "@material-symbols/svg-400/rounded/keyboard_double_arrow_up.svg";
import openInNew from "@material-symbols/svg-400/rounded/open_in_new.svg";
import progressActivity from "@material-symbols/svg-400/rounded/progress_activity.svg";
import rateReview from "@material-symbols/svg-400/rounded/rate_review.svg";
import refresh from "@material-symbols/svg-400/rounded/refresh.svg";
import settings from "@material-symbols/svg-400/rounded/settings.svg";
import starShine from "@material-symbols/svg-400/rounded/star_shine.svg";
import syncProblem from "@material-symbols/svg-400/rounded/sync_problem.svg";
import unfoldMore from "@material-symbols/svg-400/rounded/unfold_more.svg";

/** One icon: path data in its view box. */
export interface Glyph {
  readonly d: string;
  readonly viewBox: string;
}

/** A Material Symbol's one path and view box, from the package's SVG. */
function symbol(svg: string): Glyph {
  const d = /\sd="([^"]+)"/.exec(svg)?.[1];
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  if (!d || !viewBox) {
    throw new Error("Not a single-path SVG");
  }
  return { d, viewBox };
}

/** Material Symbols Rounded, weight 400 (`@material-symbols/svg-400`). */
export const ICONS = {
  add: symbol(add),
  ai: symbol(starShine),
  "chevron-down": symbol(arrowDown),
  "chevron-right": symbol(arrowRight),
  code: symbol(code),
  comment: symbol(chatBubble),
  "comment-add": symbol(addComment),
  delete: symbol(deleteIcon),
  device: symbol(devices),
  done: symbol(checkCircle),
  "done-all": symbol(doneAll),
  edit: symbol(edit),
  error: symbol(error),
  "expand-all": symbol(unfoldMore),
  "expand-down": symbol(expandDown),
  "expand-up": symbol(expandUp),
  external: symbol(openInNew),
  key: symbol(key),
  refresh: symbol(refresh),
  review: symbol(rateReview),
  settings: symbol(settings),
  spinner: symbol(progressActivity),
  synced: symbol(cloudDone),
  "sync-problem": symbol(syncProblem),
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof ICONS;
