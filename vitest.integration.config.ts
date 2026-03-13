import { createVitestConfig } from './vitest.shared';

export default createVitestConfig(['tests/integration/**/*.test.ts'], 'node');
