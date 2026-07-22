/*
# Secure handle_new_user trigger function

## Purpose
The `public.handle_new_user()` function is a trigger that fires on INSERT to
`auth.users` (i.e. when a new user signs up) and creates a corresponding row in
`public.profiles`. It must remain `SECURITY DEFINER` because the role performing
the signup insert does not have permission to write to `public.profiles` directly.

## Security Issue
By default, PostgreSQL grants EXECUTE on functions to `PUBLIC`, which includes
both the `anon` and `authenticated` roles. This meant anyone — including
unauthenticated users — could call `handle_new_user()` directly via the Supabase
REST API (`/rest/v1/rpc/handle_new_user`), bypassing the intended trigger-only
invocation path.

## Fix
1. Revoke EXECUTE on `public.handle_new_user()` from `PUBLIC`, `anon`, and
   `authenticated` so it cannot be invoked directly via RPC.
2. Grant EXECUTE only to the `postgres` (service) role, which is the role that
   fires triggers on `auth.users` inserts. The trigger will continue to work
   because trigger functions execute with the privileges of the function owner
   (the `postgres` superuser), not the calling role.
3. Keep `SECURITY DEFINER` and the locked `search_path = 'public'` so the
   function still has the privileges needed to insert into `public.profiles`.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
