import { createVitestConfig } from './vitest.shared';

export default createVitestConfig(['tests/unit/**/*.test.ts'], 'node');
