---
description: יצירת GitHub repo וחיבור הפרויקט המקומי אליו — תנאי מקדים לדיפלוי אוטומטי ב-Vercel
---

אתה עוזר לתלמיד "Game Changer" ליצור **GitHub repository** ולחבר אליו את הפרויקט המקומי. זה **תנאי מקדים** ל-`/setup-vercel` — כל הדיפלויים יעבדו דרך `git push`, לא דרך Vercel CLI.

## כללים

- **עברית** בהסברים, **אנגלית** בלבד ב-CLI commands ובתוך code blocks.
- **אל תעשה פעולות destructive** (מחיקת repo, force push, וכו') בלי אישור מפורש.
- **אל תחשוף טוקנים** בפלט.

## שלב 1 — Prerequisites

בדוק שה-`gh` CLI מותקן ושהתלמיד מחובר:

```bash
gh --version
gh auth status
```

אם `gh` לא מותקן — הדרך את התלמיד:

```bash
brew install gh          # macOS
# או: https://cli.github.com/ להתקנות אחרות
```

אם לא מחובר:

```bash
gh auth login
```

(בחר GitHub.com → HTTPS → אישור דרך browser.)

## שלב 2 — בדיקת מצב הפרויקט

1. ודא שיש git repo מקומי (`git status`). אם לא — צור (`git init -b main`).
2. בדוק שכבר לא קיים remote בשם `origin` (`git remote -v`). אם כן, שאל את התלמיד אם הוא רוצה להחליף או לבטל.
3. ודא ש-`.env.local` וקבצי secrets כבר ב-`.gitignore` לפני שדוחפים. **זה קריטי** — אסור לדחוף מפתחות.

## שלב 3 — שאל את התלמיד

שאל בעברית:

1. **שם ה-repo** (ברירת מחדל: שם התיקייה הנוכחית מ-`package.json`).
2. **public או private?** (המלצה: private להתחלה — תמיד אפשר להפוך ל-public אח"כ).
3. **תיאור קצר** (אופציונלי).

## שלב 4 — יצירה ודחיפה

צור את ה-repo ודחוף את הקוד בפקודה אחת עם `gh repo create`:

```bash
gh repo create <REPO_NAME> --private --source=. --remote=origin --push --description "<DESCRIPTION>"
```

(שנה `--private` ל-`--public` אם התלמיד בחר public.)

אם יש שינויים לא commited — עשה commit קודם:

```bash
git add -A
git commit -m "chore: prepare for initial push"
```

## שלב 5 — ודא CI-ready

אחרי שה-repo נוצר:

1. ודא שה-URL של ה-repo הודפס (`gh repo view --web` פותח בדפדפן אם צריך).
2. בדוק שה-default branch הוא `main`:
   ```bash
   git branch --show-current
   ```
3. המלץ לתלמיד (בעברית) על הגדרות מומלצות:
   - **Branch protection** ל-`main` (דורש PR לפני merge) — אופציונלי אבל best practice
   - **Deletions**: השאר מופעל רק אם הוא יודע מה הוא עושה

אם התלמיד רוצה branch protection, הסבר שזה דורש GitHub Pro לפרויקטים private, ואפשר להגדיר ידנית בדשבורד או עם:

```bash
gh api -X PUT "repos/:owner/:repo/branches/main/protection" --input protection.json
```

(אל תריץ את זה אוטומטית — רק הראה.)

## שלב 6 — סיכום

הצג לתלמיד בעברית:

- ✅ Repo נוצר: `<URL>`
- ✅ Branch ראשי: `main`
- ✅ Remote `origin` מחובר
- 📝 הצעד הבא: `/setup-vercel` — יחבר את ה-repo הזה ל-Vercel ויגדיר CI/CD אוטומטי. מעכשיו **כל `git push` ידביק deploy**.

> ⚠️ **תזכורת חשובה:** לעולם אל תדחוף את `.env.local` או את `.mcp.json`. הם ב-`.gitignore` — אבל אם הוספת קבצי secrets אחרים, ודא שגם הם שם לפני `git push` הבא.
