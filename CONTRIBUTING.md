# Contributing

Evidence Agent Lab is intentionally narrow: a deterministic, auditable loop over declared synthetic cases. Contributions should make that contract clearer or more reliable without implying production readiness.

## Before opening a change

1. Start from an issue that names the affected synthetic case ID. A new behavior or wider scope needs a new fixed case first.
2. Keep every fixture synthetic and declare its provenance in the fixture. Do not adapt real records, identifiers, screenshots, or operational material.
3. Add or update tests before implementation when behavior changes.
4. Run:

   ```bash
   npm run verify
   ```

5. Explain any benchmark snapshot change. Do not refresh the snapshot merely to hide a failing gate.

## Pull request checklist

- Link the issue and list the synthetic case IDs exercised.
- Include the focused test and the full verification result.
- Confirm that the change introduces no private data or credentials.
- Disclose whether an LLM helped write code, tests, documentation, or case text, and describe the human review performed.
- State whether `benchmark/latest.json` changed and why.

No contribution may claim production action, model training, causal uplift, external notification, or real-world calibration.
