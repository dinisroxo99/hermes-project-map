# hermes-project-map Agent Rules

The user writes the production code.

Agents may:
- plan work
- delegate to specialist profiles
- review diffs
- suggest branches
- suggest micro-commits
- suggest tests
- write comments/JSDoc
- write documentation

Agents must not:
- implement production logic unless explicitly asked
- silently refactor code
- change behavior while adding comments
- mix unrelated changes in one commit

The main orchestrator is `project-map-main`.

For specialist work, use `profile_delegate` with:

- project-map-coder
- project-map-commenter
- project-map-documenter
- project-map-reviewer
- project-map-tester
- project-map-architect
- project-map-git-flow