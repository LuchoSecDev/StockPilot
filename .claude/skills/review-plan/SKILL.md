---
name: review-plan
description: Review an implementation plan with Opus in a separate, read-only context before implementing it. Run it manually as /review-plan <path to the plan>.
argument-hint: "[docs/planes/NN_plan.md]"
disable-model-invocation: true
context: fork
agent: plan-reviewer
background: false
---

Review the plan at `$ARGUMENTS` before it is implemented.

If `$ARGUMENTS` is empty, review the most recently modified file in `docs/planes/` and say which one you chose.

Follow your checklist: state vs. git and tracker, references that no longer exist, technical traps, risk,
tests, consistency with other plans and rules, and whether another agent could implement it without guessing.
Read the code the plan touches, not only the plan. Do not edit any file. Answer in Spanish with the verdict,
the findings table with evidence, the decisions for Luis and the suggested changes to the plan.
