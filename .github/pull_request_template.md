## What

<!-- What does this change draw, fix, or enable? -->

## Why

<!-- What problem or gap prompted it? -->

## Verification

<!-- Delete what doesn't apply. -->

- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] Golden hashes: unchanged / intentionally regenerated (gallery eyeballed first)
- [ ] `node scripts/hash-baseline.mjs compare` (if the CLI surface changed)
- [ ] Gallery re-rendered and judged across the whole album (if tuning changed)

## Plottability

<!-- Delete if this change doesn't emit lines. -->

- [ ] Output is plain stroked paths, one pen at one width
- [ ] Deterministic per seed
