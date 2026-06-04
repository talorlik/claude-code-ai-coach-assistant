# Admin Role Setup

How to grant the trainer (Itai) the `admin` role so the `/admin` trainer
surfaces and the `is_trainer_admin()` row-level-security policies recognize the
account. There is intentionally no self-service UI for this: role escalation is
a privileged operation performed manually against the database.

## Background

- The `user_roles` table holds one row per `(user_id, role)`. The `role` column
  is the `public.app_role` enum, whose values are `admin` and `customer`.
- "Trainer admin" in the product maps to the `admin` role. Clients are every
  other authenticated user; they do not need a `user_roles` row at all (absence
  of an `admin` row is treated as a normal client).
- Server guards: `requireTrainerAdmin()` (and its alias `requireAdmin()`) gate
  the `/admin` subtree. The SQL function `public.is_trainer_admin()` gates the
  RLS policies. Both check for an `admin` row for the current user.
- The designated trainer admin is `talorlik@gmail.com`.

> [!IMPORTANT]
> Granting `admin` bypasses client-level RLS on every app table (trainer-admin
> policies use `is_trainer_admin()`). Only grant it to the trainer account.

## Prerequisites

1. The target user has signed up and confirmed their email at least once, so a
   row exists in `auth.users`. The grant references that user's `id`.
2. You can run SQL against the project with privileges that bypass RLS: the
   Supabase SQL editor, or an MCP/admin connection using the secret key. The
   anon/publishable role cannot insert into `user_roles` for another user.

## Grant The Admin Role

Run this once. It looks the user up by email and inserts the `admin` row,
ignoring the insert if it already exists, so it is safe to re-run.

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where email = 'talorlik@gmail.com'
on conflict (user_id, role) do nothing;
```

## Verify

The query returns one row when the grant succeeded.

```sql
select u.email, r.role
from public.user_roles r
join auth.users u on u.id = r.user_id
where u.email = 'talorlik@gmail.com'
  and r.role = 'admin';
```

After this, signing in as `talorlik@gmail.com` redirects to `/admin` and the
trainer surfaces become reachable. A signed-out visitor to `/admin` is sent to
login, and a signed-in non-admin is sent to the localized home page.

## Revoke (If Ever Needed)

```sql
delete from public.user_roles
where role = 'admin'
  and user_id = (
    select id from auth.users where email = 'talorlik@gmail.com'
  );
```
