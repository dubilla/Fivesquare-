/**
 * Environment variable validation
 * Ensures all required environment variables are present
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'GOOGLE_MAPS_API_KEY'
] as const;

// Optional environment variables for future use
// const optionalEnvVars = [
//   'NEXT_PUBLIC_POSTHOG_KEY',
//   'NEXT_PUBLIC_POSTHOG_HOST'
// ] as const;

export function validateEnv() {
  const missing: string[] = [];
  
  // Check required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  
  if (missing.length > 0) {
    console.error('\n❌ Missing required environment variables:');
    missing.forEach(envVar => {
      console.error(`   - ${envVar}`);
    });
    console.error('\nPlease copy .env.local.example to .env.local and fill in the required values.\n');
    
    // Exit the process in development to fail fast
    if (process.env.NODE_ENV === 'development') {
      process.exit(1);
    }
    
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ All required environment variables are present');
}

// Export environment variables with proper typing
export const env = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  
  // Google Maps
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY!,
  
  // PostHog (optional)
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  
  // Node environment
  NODE_ENV: process.env.NODE_ENV || 'development'
} as const;