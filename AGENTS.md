# Agent instructions

- `TIMEWISE_SPEC.md` is the authoritative specification.
- Update `DEVELOPMENT_STATUS.md` after each milestone, labelling features with the spec's status terms.
- Before finishing a milestone, run: typecheck, unit tests, build, browser tests. Then look at real screenshots, because passing tests have already missed a zero-height map.
- Never add a historical claim without a retrieved source. Run `npm run verify:sources` after changing the dataset.
- Never reproduce source text unless its rights allow it: paraphrase and link. Unknown rights stay `link_and_paraphrase_only`.
- Never mark content `expert_reviewed` unless a human historian reviewed it.
- No fake buttons or simulated AI. Unbuilt features are labelled as planned or left out.
