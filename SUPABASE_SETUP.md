# Supabase Project Setup Guide (Task B-1)

This guide walks you through provisioning your Supabase project for the Reordr MVP application.

## 🎯 Task B-1 Requirements

- ✅ Create project, enable email+password & magic-link auth
- ✅ **AC:** Console shows Auth tab configured; no social providers enabled

## Step 1: Create Supabase Account and Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" and sign up with your preferred method
3. Once logged in, click "New Project"
4. Fill in the project details:
   - **Organization**: Select or create an organization
   - **Name**: `reordr-mvp` (or your preferred name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose the region closest to your users
   - **Pricing Plan**: Start with the Free tier

5. Click "Create new project"
6. Wait for the project to be created (this takes 2-3 minutes)

## Step 2: Configure Authentication

1. In your Supabase dashboard, navigate to **Authentication** > **Settings**
2. Under **Auth Providers**, ensure the following:
   - ✅ **Email** is enabled (should be enabled by default)
   - ❌ **All social providers are disabled** (Google, GitHub, etc.)
   
3. Under **Email Authentication**:
   - ✅ Enable **Email confirmation** (recommended)
   - ✅ Enable **Magic Link** authentication
   - Set **Site URL** to `http://localhost:3000` for development

4. Under **Security Settings**:
   - Set **JWT expiry limit** to 3600 (1 hour, or your preference)
   - Enable **Refresh Token Rotation** (recommended)

## Step 3: Get Your Project Credentials

1. Navigate to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (looks like `https://xxx.supabase.co`)
   - **Project API Key** > **anon public** (starts with `eyJ...`)
   - **Project API Key** > **service_role** (for development only)

## Step 4: Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Update `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   
   # For development only
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

3. Leave other variables for now (you'll set them up in later tasks):
   ```env
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
   NEXT_PUBLIC_POSTHOG_HOST=your_posthog_host
   ```

## Step 5: Test the Setup

1. Start the development server:
   ```bash
   pnpm dev
   ```

2. You should see:
   ```
   ✅ All required environment variables are present
   ```

3. If you see environment variable errors, double-check your `.env.local` file

## Step 6: Initialize Supabase CLI (Optional)

For local development and migrations:

```bash
# Initialize Supabase in your project
pnpm supabase init

# Link to your remote project
pnpm supabase link --project-ref your-project-ref

# Pull the current schema
pnpm supabase db pull
```

## 🎉 Task B-1 Complete!

Your Supabase project is now provisioned and configured with:
- ✅ Email + password authentication enabled
- ✅ Magic link authentication enabled  
- ✅ No social providers enabled
- ✅ Environment variables configured
- ✅ Supabase client setup in Next.js

## What's Next?

- **Task B-2**: User provider wrapper (`<SessionContextProvider>`)
- **Task B-3**: Auth UI (`/login` screen)

## Troubleshooting

### Environment Variable Errors
- Ensure `.env.local` is in the project root
- Check that values don't have quotes around them
- Restart `pnpm dev` after changing environment variables

### Supabase Connection Issues
- Verify your project URL doesn't have trailing slashes
- Ensure the anon key is copied correctly (very long string)
- Check that your project is not paused (free tier auto-pauses after inactivity)

### Authentication Not Working
- Verify Site URL is set to `http://localhost:3000` in Supabase Auth settings
- Check that email confirmation is properly configured
- Ensure you're using the correct project reference

## Useful Commands

```bash
# Check Supabase status
pnpm supabase status

# View Supabase logs
pnpm supabase logs

# Reset local database
pnpm db:reset
```