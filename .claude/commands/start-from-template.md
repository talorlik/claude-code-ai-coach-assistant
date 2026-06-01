---
description: מדריך אינטראקטיבי לחיבור Supabase (כולל MCP חובה) והקמת דף בית — אתחול ראשוני לטמפלייט
---

אתה עוזר לתלמיד של קורס "Game Changer" לחבר את ה-backend לפרויקט מהטמפלייט. התלמיד כבר הריץ `npm run setup`.

## כללים

- **דבר עברית** עם התלמיד בכל ההסברים.
- פקודות CLI — **באנגלית בלבד** (בתוך code blocks).
- **אל תעשה הכל במכה** — שאל אישור לפני כל שלב.
- **אל תנחש APIs** — השתמש ב-skill `context7-mcp` למשיכת דוקומנטציה עדכנית של Supabase SSR לפני שאתה כותב קוד.
- ⚠️ **shadcn components כבר מותקנים** בטמפלייט (כל ה-components ב-`components/ui/`). **אל תציע להתקין אותם שוב**.

## השלבים

### שלב 1 — בדיקת מצב

1. קרא את `.env.local` — בדוק אילו משתנים חסרים מתוך:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
2. בדוק אם קיים `.mcp.json` בשורש (לא `.mcp.example.json`).
3. דווח לתלמיד בעברית, בקצרה, מה יש ומה חסר.

### שלב 2 — פרויקט Supabase + מפתחות חדשים

הסבר לתלמיד:

> Supabase הוציאו **סכימת API keys חדשה** (2026) עם שני סוגי מפתחות: `publishable` (בטוח לדפדפן) ו-`secret` (רק לשרת). אנחנו נשתמש בחדשים — **לא** ב-anon/service_role הישנים.

1. שאל אם יש לו פרויקט Supabase קיים. אם לא — שלח אותו ליצור אחד:
   `https://supabase.com/dashboard/new`

2. בקש ממנו את ה-**Project Ref** (לא URL מלא).
   הסבר: ה-Project Ref הוא המזהה הקצר של הפרויקט — אפשר למצוא אותו ב:
   - Dashboard → Project Settings → General → **Reference ID**
   - או ב-URL של הדשבורד: `https://supabase.com/dashboard/project/<PROJECT_REF>`

3. בקש את ה-**Publishable Key** וה-**Secret Key** (החדשים, מתחילים ב-`sb_publishable_` ו-`sb_secret_`):
   - Dashboard → Project Settings → API Keys → טאב **"Publishable and secret API keys"** (לא הטאב של legacy)
   - מיקום: `https://supabase.com/dashboard/project/<PROJECT_REF>/settings/api-keys`

4. עדכן את `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   ```
   (גזור את ה-URL מה-Project Ref — אין צורך לשאול על ה-URL בנפרד.)

### שלב 3 — התקנת Supabase SSR + client files

CLI:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

צור 3 קבצים — השתמש ב-Context7 לפני כדי לוודא שאתה כותב את הפטרן העדכני של `@supabase/ssr`:

- `lib/supabase/client.ts` — browser client (קורא את `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `lib/supabase/server.ts` — server client (קורא את `SUPABASE_SECRET_KEY` כשצריך privileged access; אחרת את ה-publishable)
- `lib/supabase/middleware.ts` — `updateSession` לרענון cookies

ואז `middleware.ts` בשורש שמייבא את `updateSession`.

> **הערה לגבי השמות:** ב-`createBrowserClient` / `createServerClient` של `@supabase/ssr`, הפרמטר השני הוא ה-**publishable key** (לא anon). ה-secret key משמש רק ב-server-side calls שדורשים הרשאות מוגברות.

### שלב 4 — אימות Supabase MCP (חובה — project-scoped)

הסבר לתלמיד בעברית:

> Supabase MCP מאפשר ל-Claude Code **לדבר ישירות עם ה-DB שלך** — queries, migrations, schema, ועוד. ה-MCP מוגדר **project-scoped** (בקובץ `.mcp.json` בפרויקט עצמו, לא בהגדרות הגלובליות של Claude Code) — ככה כל פרויקט מחובר ל-DB שלו בלבד.

1. בדוק את מצב `.mcp.json`:
   - אם הוא **לא קיים** → `npm run setup` לא רץ (או המשתמש מחק). הרץ אותו מחדש או צור ידנית מ-`.mcp.example.json`.
   - אם הוא **קיים** אבל מכיל `<PROJECT_REF>` / `<SUPABASE_PERSONAL_ACCESS_TOKEN>` (placeholders) → המשך להשלים.
   - אם הוא **מלא כבר** → דלג לסעיף 4 (אימות).

2. אם חסר **Personal Access Token** — בקש מהתלמיד ליצור:
   `https://supabase.com/dashboard/account/tokens` → **Generate new token** → שם תיאורי (למשל: `claude-code-mcp`) → העתק (מוצג פעם אחת בלבד).

3. ערוך את `.mcp.json` והחלף את ה-placeholders בערכים האמיתיים — ה-Project Ref (מהשלב הקודם) וה-PAT. המבנה אמור להישאר זהה ל-`.mcp.example.json`. **ודא שה-URL לא מכיל `read_only=true`** — ה-MCP חייב לרוץ עם גישה מלאה (read + write) כדי שמיגרציות וסכמות יעבדו.

4. בקש מהתלמיד **להפעיל מחדש את Claude Code** (exit + `claude` שוב) כדי שה-MCP יטען.

5. אחרי שיחזור — אמת שה-MCP עובד על ידי קריאה ל-`mcp__supabase__list_tables` (אמור להחזיר את הטבלאות או רשימה ריקה). אם נכשל — דבג (טוקן שגוי? project ref שגוי? פורמט `.mcp.json`?).

> 💡 הקובץ `.mcp.json` ב-`.gitignore` — הטוקן לא יעלה ל-git. אל תעלה אותו ידנית.

### שלב 5 — דף בית אמיתי

החלף את `app/page.tsx` בדף landing מינימלי אבל יפה:
- כותרת עם שם הפרויקט (קח מ-`package.json`)
- טקסט קצר שמסביר מה זה
- כפתור "Get Started" / "Sign In" (משתמש ב-Supabase auth)
- dark mode toggle (יש `next-themes` + `components/theme-provider.tsx`)

השתמש אך ורק ב-components שכבר קיימים ב-`components/ui/`.

### שלב 6 — בדיקה

CLI:

```bash
npm run typecheck
npm run dev
```

ודא שאין שגיאות TypeScript ושהדף עולה ב-`http://localhost:3000`.

### שלב 7 — סיכום

הצג לתלמיד בעברית:
- ✅ מה מחובר: Supabase (env + client files + middleware), MCP, דף בית
- 📝 מה עוד כדאי: auth flow מלא (login/signup), טבלאות ב-DB, RLS policies

🚀 **הצעדים הבאים (מומלצים בסדר הזה):**

1. רוצה AI באפליקציה?
   ```
   /setup-vercel-ai
   ```

2. מוכן לדיפלוי לפרודקשן (CI/CD דרך GitHub → Vercel)?
   ```
   /setup-github      # יוצר GitHub repo
   /setup-vercel      # מחבר ל-Vercel עם auto-deploy על כל git push
   ```

   > ⚠️ הסדר חשוב: **GitHub חייב להיות קודם**. אחרי `/setup-vercel`, כל `git push` ל-`main` יהפוך ל-production deploy אוטומטית.
