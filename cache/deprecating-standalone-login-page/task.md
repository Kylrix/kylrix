Task: Deprecate the standalone login page and replace auth entry points with a login bottom drawer.

Scope:
- Use a bottom drawer for "Continue with" options: Google, GitHub, and email OTP.
- Remove the need for standalone page blurring / blocked-access patterns in flows that currently gate on auth.
- Keep this as a cache/task note only; do not implement code changes here.

Notes:
- This task should unify login entry points behind the drawer.
- Any existing blur-or-block auth hooks should be treated as candidates for replacement with the drawer trigger.
