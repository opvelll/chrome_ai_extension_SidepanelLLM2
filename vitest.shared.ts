import { defineConfig } from 'vitest/config';

export function createVitestConfig(
  include: string[],
  environment: 'node' | 'jsdom',
  setupFiles?: string[],
) {
  return defineConfig({
    test: {
      include,
      environment,
      setupFiles,
    },
  });
}
