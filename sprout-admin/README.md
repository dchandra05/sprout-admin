# Sprout Admin Dashboard

A separate Vite + React app that connects to the same Supabase project
as the main Sprout student app. Admins-only.

---

## File Tree

```
sprout-admin/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.local
│
├── migrations/
│   ├── 001_admin_schema.sql      ← Run first in Supabase SQL editor
│   └── 002_rls_policies.sql      ← Run second
│
├── FOR_MAIN_APP/
│   └── activityTracker.js        ← Copy to main app: src/lib/activityTracker.js
│
└── src/
    ├── main.jsx
    ├── App.jsx                   ← Router + AdminGuard
    ├── index.css
    ├── lib/
    │   ├── supabaseClient.js     ← Same project, separate session key
    │   ├── AuthContext.jsx       ← Auth + admin role check
    │   ├── queryClient.js
    │   └── adminApi.js           ← All data fetching
    ├── components/
    │   ├── Layout.jsx            ← Sidebar + nav
    │   ├── StatCard.jsx
    │   └── ChartCard.jsx
    └── pages/
        ├── Login.jsx             ← /login
        ├── Dashboard.jsx         ← /dashboard — KPIs + charts
        ├── Users.jsx             ← /users — searchable table
        ├── UserDetail.jsx        ← /users/:id — drilldown
        └── Courses.jsx           ← /courses — AI course analytics
```

---

## Setup

### 1. Run SQL migrations

In Supabase Dashboard → SQL Editor, run both files in order:

1. `migrations/001_admin_schema.sql`
2. `migrations/002_rls_policies.sql`

Then promote your admin account:
```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
```

### 2. Configure environment

`.env.local` is already pre-filled with your Supabase project URL and anon key
(same values as the main app).

### 3. Install and run

```bash
cd sprout-admin
npm install
npm run dev        # starts on http://localhost:5174
```

### 4. Wire activity tracking into the main app

Copy `FOR_MAIN_APP/activityTracker.js` → main app's `src/lib/activityTracker.js`

Then add these calls in the main app:

**After login** (in `Login.jsx` or Supabase `onAuthStateChange`):
```js
import { trackLogin } from "@/lib/activityTracker";
// after successful sign-in:
await trackLogin();
```

**After completing an AI lesson** (in `upsertAIDayProgress` call in each AIDay page):
```js
import { trackLessonComplete } from "@/lib/activityTracker";
// after successful upsert:
await trackLessonComplete(dayNumber, quizScore);
```

**On route change** (in main app's router/layout):
```js
import { touchLastSeen } from "@/lib/activityTracker";
// in a useEffect that watches location:
touchLastSeen(); // throttled internally to once/minute
```

### 5. Deploy separately

The admin app builds independently:
```bash
npm run build      # outputs to dist/
```

Deploy to any static host (Vercel, Netlify, GitHub Pages) with a different
subdomain from the student app, e.g. `admin.sprout.app`.

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Login | Supabase Auth (email + password) — same project as main app |
| Role check | `profiles.role = 'admin'` checked in `AuthContext` before rendering any page |
| RLS | All tables have RLS enabled. Admins can read all rows; users only their own |
| No auth.users access | Admin reads from `profiles` table only — never queries `auth.users` directly |
| Session isolation | Admin app uses `storageKey: "sprout-admin-auth"` to avoid session collision with student app |

---

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Admin sign-in (real Supabase auth) |
| `/dashboard` | KPIs (DAU/WAU/MAU, total users, signups), 30-day trend charts |
| `/users` | Searchable user table with AI progress, XP, last seen |
| `/users/:id` | Per-user drilldown: profile, all 10 AI days with scores, activity log |
| `/courses` | AI Literacy completion rates per day, avg scores, hardest day |

---

## Adding More Courses

When you add more courses beyond the AI Literacy course, extend `adminApi.js`
to query those tables. The `user_activity_events` table with `event_type`
is flexible enough to track any future lesson type without schema changes.
