# Repository rules for Copilot

## Supabase database migrations
- Any migration that creates a new table in the `public` schema must include explicit GRANT statements immediately after the CREATE TABLE.
- Default to granting only `service_role`, for example:
  `grant select, insert, update, delete on public.<table_name> to service_role;`
- Only grant `anon` or `authenticated` if the table is explicitly meant to be read or written from the browser, and say so in the PR description.
- Never change grants on existing tables unless the task explicitly asks for it.
