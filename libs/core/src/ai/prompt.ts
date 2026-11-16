/** The instructions for the model and the JSON schema of its answer. */

/** Bumped when the prompt or the schema changes, so cached answers expire. */
export const PROMPT_VERSION = 2;

const TASK = `You help a code reviewer decide in which order to read a pull request.

A static analysis has already split the change into groups and ordered them:
"context" (docs, read first), "story" groups (files linked by imports and
names, each in dependency order: what is used comes before what uses it),
"mechanical" groups (the same small edit in many files, read as one item),
"misc" groups (repository config, standalone files, tests of unchanged code)
and "generated" (set aside).

Improve the plan where the analysis is weak, and leave it alone where it is
right:
- Name every story and misc group by what it does for the change, in a few
  words (e.g. "Refund window in days instead of hours"), and give each group a
  one-sentence purpose a reviewer reads before its files.
- Order the groups (all but context and generated) the way a reviewer should
  read them: core changes (schema, contract, shared library) before their
  consumers, related stories next to each other, configuration before the
  code it sets up.
- Move a file to another group when it clearly belongs there: a doc next to
  the story it describes, a config file into the story it configures, a
  standalone file or test into the story it is part of. Moves are only
  allowed out of context, story and misc groups, and only into story and misc
  groups. Don't move files for small gains.
- Flag links that don't carry a real dependency (a name that only appears in a
  comment, an import of a file whose changes the importer doesn't use).

In the answer, refer to groups by their id and to files by their exact path.
Titles, purposes and reasons are shown to the reviewer after your changes, so
never mention group ids or numbers in them; name the other group or file
instead. Write them in plain English, without Markdown.`;

export const FULL = `${TASK}

You see the groups, the links the analysis found between files, and a trimmed
diff of every file.`;

export const SUMMARY = `${TASK}

You see the groups, the links the analysis found between files, and per file
the names its diff touches and its first changed lines, not the whole diff.
Read the diff of a file with the read_diff tool when the summary doesn't tell
you enough to name a group, place a file or judge a link; ask for several
files in one call. For many pull requests the summary is enough: then answer
right away. Reading is limited; the tool says when the budget is used up.`;

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["order", "groups", "moves", "weakEdges"],
  properties: {
    order: {
      type: "array",
      description:
        "Ids of every group except context and generated, in reading order.",
      items: { type: "integer" },
    },
    groups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "purpose"],
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          purpose: { type: "string" },
        },
      },
    },
    moves: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "to", "reason"],
        properties: {
          path: { type: "string" },
          to: { type: "integer", description: "Id of the target group." },
          reason: { type: "string" },
        },
      },
    },
    weakEdges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "reason"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;
