import type { NextConfig } from 'next';
import { validateEnv } from './src/lib/env';

// Validate environment variables at app startup
validateEnv();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
