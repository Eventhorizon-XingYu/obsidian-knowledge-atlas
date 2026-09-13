# Contributing

Use Node.js 22+ and `npm ci --ignore-scripts`. Run `npm run check` before sending a pull request. Use a disposable vault for mutation tests; never commit a private vault or its `.obsidian` configuration.

Data rules belong in `src/graph.ts`; native vault writes belong in `src/operations.ts`. Prefer Obsidian's public APIs for file operations, metadata and rendering. Keep event listeners, previews, timers and graph resources tied to the plugin/view lifecycle. All labels belong in `src/i18n.ts` in both languages. Preserve the existing-file collision checks and confirmation dialogs.

Please include steps to reproduce bugs, host version, relevant settings and a minimal synthetic vault. Do not attach personal notes. Add focused tests for behavior changes, and validate interactive changes in real Obsidian as described in `docs/TESTING.md`.
