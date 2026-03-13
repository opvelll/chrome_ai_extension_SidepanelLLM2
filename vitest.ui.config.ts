import { createVitestConfig } from './vitest.shared';

export default createVitestConfig(['tests/ui/**/*.test.tsx'], 'jsdom', ['tests/setup/ui.ts']);
