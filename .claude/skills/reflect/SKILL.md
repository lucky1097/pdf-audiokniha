---
name: reflect
description: End-of-session review for pdf-audiokniha. Lists what went wrong or took too long in this session, proposes the smallest edit to a skill, agent or CLAUDE.md that would have prevented each, and waits for the user's OK before applying anything. Use at the end of every session, or when the user says "reflect".
---

# Reflect

1. Go through this session: failed checks, workers sent back, wrong guesses, steps repeated, user corrections,
   anything that took much longer than it should have.
2. For each, write:
   - What happened (one line), with evidence: the command and output, the commit, or the user's words.
   - The cause: a missing rule, a vague brief, a missing check, a gotcha nobody had written down.
   - The smallest edit that would have prevented it: the file (CLAUDE.md, docs/known-issues.md,
     .claude/agents/*.md, .claude/skills/*/SKILL.md), and the exact lines to add or change.
3. Skip items with no clear cause or no small fix. No more than five proposals; the strongest first.
4. Show the list and stop. Apply only the edits the user approves, exactly as approved.
5. After applying, make sure docs/progress.md and docs/decisions.md are up to date for this session.
