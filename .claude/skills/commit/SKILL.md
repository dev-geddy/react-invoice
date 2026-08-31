---
name: commit
description: >
  Commit message convention for this repo: semantic (Conventional Commits)
  one-liner, no body, no trailers, no Co-Authored-By. Load WHENEVER you write a
  commit message, run git commit, or stage changes to commit. Also on:
  "commit", "commit message", "write a commit", "git commit".
---

# commit

Repo commit convention. One rule set, no exceptions.

## Format
- **Semantic one-liner only.** `type(scope): subject` — single line, nothing else.
- **No body.** No blank line + paragraphs. No bullet lists.
- **No trailers / footers.** No `Co-Authored-By`, no `Generated with`, no issue refs unless asked.
- Imperative mood, lowercase subject, no trailing period. Aim ≤72 chars.

## Types
`feat` `fix` `docs` `chore` `refactor` `style` `test` `build` `ci` `perf`

## Scope
Optional. Package/area: `web`, `ui`, `auth`, `docs`, … Use when it sharpens meaning.

## Examples
- `feat(auth): add google login callback`
- `fix(ui): mount tooltip provider in root layout`
- `chore(web): run dev server on port 3070`
- `docs: bootstrap three-level doc system`

## Do NOT
- Multi-line bodies, "why" paragraphs, checklists.
- `Co-Authored-By:` or any co-author trailer.
- Tool/agent attribution footers.

## Commit command
`git commit -m "type(scope): subject"` — single `-m`, one line.
