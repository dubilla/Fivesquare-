// Export all Supabase client functions
export { createClient as createBrowserClient } from './client'
export { createClient as createServerClient } from './server'
export { updateSession } from './middleware'

// Re-export Supabase types for convenience
export type { 
  User, 
  Session, 
  AuthError,
  AuthResponse,
  UserResponse
} from '@supabase/supabase-js'