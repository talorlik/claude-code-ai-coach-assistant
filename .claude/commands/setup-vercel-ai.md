---
description: חיבור Vercel AI Gateway לפרויקט — 5$ קרדיט חינם כל חודש לגישה לכל מודלי ה-AI
---

אתה עוזר לתלמיד של הקורס "Game Changer" לחבר את **Vercel AI Gateway** לפרויקט שלו. ה-gateway נותן גישה מאוחדת לכל המודלים (Anthropic, OpenAI, Google, וכו') עם **5$ קרדיט חינם כל חודש**.

## תנאי מקדים

- הפרויקט אותחל עם `npm run setup`.
- אם התלמיד עוד לא הריץ `/start-from-template` — עדיף שיעשה את זה קודם. שאל אותו.

## השלבים

### שלב 1 — בדיקת מצב

1. קרא את `.env.local` ובדוק אם `AI_GATEWAY_API_KEY` כבר מוגדר.
2. אם כן — שאל את התלמיד אם הוא רוצה להוסיף feature AI חדש או לאבחן בעיה קיימת.
3. אם לא — המשך לשלב 2.

### שלב 2 — קבלת מפתח

1. הסבר לתלמיד בעברית:
   > "Vercel AI Gateway נותן לך גישה ל-Claude, GPT, Gemini וכל המודלים הגדולים דרך API אחד. 5$ קרדיט חינם כל חודש — מספיק לאלפי בקשות."
2. תן לו את הקישור: https://vercel.com/ai-gateway
3. הסבר איך לייצר מפתח (dashboard → AI Gateway → Create API Key).
4. בקש ממנו להדביק את המפתח והכנס אותו ל-`.env.local` תחת `AI_GATEWAY_API_KEY`.

### שלב 3 — התקנה

```bash
npm install ai @ai-sdk/gateway
```

### שלב 4 — יצירת route דוגמה

צור `app/api/chat/route.ts` שמשתמש ב-gateway. העדף את הפטרן של AI SDK v6 עם מחרוזת provider/model:

- לצ'אט: `"anthropic/claude-sonnet-4-6"` (ברירת מחדל מומלצת)
- לחלופין: `"openai/gpt-4o"`, `"google/gemini-2.5-pro"`

השתמש ב-`streamText` עם `toUIMessageStreamResponse` כדי שהסטרימינג יעבוד.

### שלב 5 — UI דוגמה

שאל את התלמיד אם הוא רוצה שנוסיף גם UI צ'אט:
- אם כן — צור `app/chat/page.tsx` עם `useChat()` מ-`ai/react` + shadcn components (`Input`, `Button`, `Card`).
- אם אין shadcn components — הצע להריץ `npx shadcn@latest add button input card scroll-area`.

### שלב 6 — בדיקה

1. הרץ `npm run typecheck`.
2. אם dev server לא רץ — הפעל ברקע.
3. בקש מהתלמיד לנסות: פתח `/chat` ותשלח הודעה.
4. אם יש שגיאה — דבג את השורש (מפתח שגוי, quota, network).

### שלב 7 — צעדים הבאים

הצע לתלמיד בעברית 3 כיווני המשך רלוונטיים:
- 🔧 **Tool calling** — תן ל-AI להפעיל פונקציות בקוד שלך
- 📝 **Structured output** — `generateObject` עם Zod schema
- 🎨 **Image/video generation** — AI Gateway תומך גם ביצירת תמונות
- 🤖 **Agents** — `experimental_agent` ל-workflows מורכבים

## עקרונות

- **דבר עברית**.
- **השתמש ב-skills** הזמינים: `vercel:ai-gateway`, `vercel:ai-sdk` — אל תנחש APIs.
- **שלוף דוקומנטציה עדכנית** עם Context7 לפני שכותב קוד AI SDK.
- **העדף מחרוזת `provider/model`** דרך ה-gateway על פני חבילות `@ai-sdk/anthropic` ישירות — אלא אם התלמיד ביקש במפורש.
- אחרי כל שינוי — ודא ש-`npm run typecheck` עובר.
