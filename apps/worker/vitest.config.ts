import { defineConfig } from 'vitest/config';

// Scoring, result derivation and push encryption are pure modules, so the suite runs in plain Node.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], environment: 'node' } });
