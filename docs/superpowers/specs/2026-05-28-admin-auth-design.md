# Admin Authentication – Design Spec
_Date: 2026-05-28_

## Background

GameOn is being prepared for commercial sale. Currently all admins share a single hardcoded password and all games are visible to everyone. To support multiple customers, each customer needs their own account and their data must be isolated from other customers.

This spec covers the authentication system only. Custom missions (a dependent feature) will be specced separately once auth is in place.

---

## Roles

| Role | Description |
|---|---|
| **Customer (admin)** | Registers with email + password. Sees only their own games and missions. |
| **Super-admin** | The GameOn owner. Identified by `app_metadata.role = 'superadmin'` in Supabase. Has read access to all customers' games. |
| **Team** | Unaffected. Logs in with game key as today. |

---

## Authentication Flow

**New customer:**
1. Visits GameOn → clicks Admin tab → sees "Log in / Register" toggle
2. Fills in email + password → account created via Supabase Auth
3. Lands in their admin dashboard with no games yet

**Returning customer:**
1. Visits GameOn → clicks Admin tab → enters email + password
2. Session restored automatically (Supabase keeps sessions alive across browser restarts)

**Super-admin:**
- Logs in with their own email + password
- `app_metadata.role = 'superadmin'` set manually in Supabase dashboard
- Sees an extra "Customers" tab in admin panel listing all accounts

**Password reset:**
- Handled automatically by Supabase (sends reset email)
- No custom code needed in v1

**The current single admin password is removed.** The super-admin gets a personal email/password account instead.

---

## Database Changes

### 1. Add `user_id` to `games` table
```sql
ALTER TABLE games ADD COLUMN user_id UUID REFERENCES auth.users(id);
```
- All existing games assigned to the super-admin's `user_id`
- RLS policy: `user_id = auth.uid()` OR `auth.jwt()->>'role' = 'superadmin'`

### 2. Move `powerups_used` and `hot_potato` from `settings` to `games`
```sql
ALTER TABLE games ADD COLUMN powerups_used TEXT[] DEFAULT '{}';
ALTER TABLE games ADD COLUMN hot_potato JSONB DEFAULT NULL;
```
**Why:** The current `settings` table has a single shared row (id=1). If two customers run games simultaneously, their power-up state would collide — e.g. Customer A activating Final Frenzy would block Customer B from using it. Moving these fields to `games` scopes them correctly per game.

The `settings` table is retired after migration.

### 3. Existing data
- All existing games: assign `user_id` = super-admin's UUID
- The `settings` row (id=1): copy `powerups_used` and `hot_potato` values to the corresponding game row, then drop the settings table (or leave unused).

---

## API Changes

All routes that currently read/write `settings` must be updated to read/write the `games` row instead:

| Route | Change |
|---|---|
| `GET /api/settings` | Read `powerups_used`, `hot_potato` from `games` by `game_id` |
| `POST /api/admin/powerup` | Write `powerups_used` to `games` row |
| `POST /api/admin/powerup/resolve-hot-potato` | Write `hot_potato` to `games` row |
| `POST /api/admin/game/start` (restart) | Clear `powerups_used`, `hot_potato` on `games` row |
| `GET /api/poll` | Read `powerups_used`, `hot_potato` from `games` row |

All admin routes must verify `auth.uid()` matches the game's `user_id` (or super-admin).

---

## UI Changes

### LoginScreen
- Admin tab gets a "Log in / Register" toggle (default: Log in)
- Register form: email + password + confirm password
- Login form: email + password
- Supabase Auth handles the calls — no custom `/api/admin/login` needed
- "Forgot password?" link triggers Supabase password reset email

### AdminScreen
- No visible change for customers — they see only their own games as before
- "Log out" calls `supabase.auth.signOut()` instead of clearing local state
- New "Customers" tab visible only to super-admin:
  - Lists all registered accounts (email, game count, last active)
  - No edit/delete in v1 — read-only overview

### Session persistence
- Supabase session survives browser restarts
- On app load: check `supabase.auth.getSession()` — if valid admin session exists, skip login screen

---

## Out of Scope (v1)

- Email verification (can be enabled in Supabase settings later)
- OAuth (Google/GitHub login)
- Customer billing or subscription management
- Admin ability to invite team members to their account
- Custom missions (separate spec, depends on this feature)

---

## Migration Plan

1. Run SQL migrations (add columns, RLS policies)
2. Back-fill `user_id` on existing games with super-admin UUID
3. Copy `powerups_used` / `hot_potato` from settings row to games rows
4. Deploy updated API routes
5. Deploy updated UI
6. Verify existing games still work
7. Remove old admin password from environment variables
