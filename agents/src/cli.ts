/**
 * CLI entry point — loads environment variables then starts the agent runtime.
 * Use this for standalone agent backend deployment.
 *
 * For Next.js integration, import from './index.ts' directly
 * (Next.js loads env vars automatically).
 */
import 'dotenv/config';
export * from './index.js';
