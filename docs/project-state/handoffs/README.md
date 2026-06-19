# Session Handoffs

## Purpose
This directory contains concise session handoffs for future agents and maintainers.

Use handoffs when a session changes implementation, planning, or project direction enough that the next session needs continuity beyond the current status docs.

---

## Naming

Use this format:

```text
YYYY-MM-DD-short-title.md
```

Examples:

```text
2026-05-24-auth-foundation.md
2026-05-24-dashboard-ui-pass.md
```

---

## Template

```md
# Session Handoff: YYYY-MM-DD Short Title

## Closeout
- Closed At: YYYY-MM-DD h:mm AM/PM [TIMEZONE]
- Closed By: [USER_OR_OPERATOR]

## Summary
- [WHAT_CHANGED]

## Files Changed
- `[FILE_PATH]`: [WHY_IT_CHANGED]

## Decisions Made
- [DECISION_OR_NONE]

## Validation
- [CHECK_OR_TEST_RUN]

## Open Questions
- [QUESTION_OR_NONE]

## Next Suggested Step
- [NEXT_STEP]
```

---

## Rules

- Keep handoffs factual and brief.
- Include closeout date/time in 12-hour format, using local or project timezone when known.
- Include the user or operator who requested or performed closeout.
- Link PRDs, TDDs, ADRs, or implementation status where relevant.
- Do not duplicate the full implementation-status document.
- Do not include secrets, credentials, tokens, private keys, or `.env` values.
- Prefer updating `../implementation-status.md` for durable state and use the handoff for session continuity.
