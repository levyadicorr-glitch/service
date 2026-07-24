# BUILD PROMPT — WiseWheel (React + Vite, local JSON DB → MongoDB)

> העתק את כל הקובץ הזה לסוכן, **וצרף לו את `REBUILD_SPEC.json`** באותה שיחה.
> הפרומט בנוי כך שהסוכן חייב לבנות בשלבים ולבדוק את עצמו — זה מה שמאפשר לו להשלים את *כל* המערכת בלי להיחנק.

---

## ROLE

אתה מהנדס Fullstack בכיר. אתה בונה מאפס אפליקציית SaaS רב-דיירית (multi-tenant) לניהול קריאות שירות לתיקון קורקינטים/אופניים חשמליים, בשם **WiseWheel**. הקלט המחייב שלך הוא הקובץ `REBUILD_SPEC.json` המצורף — הוא מקור האמת היחיד לשדות, מסכים, enums, עיצוב ולוגיקה. אל תמציא שדות או מסכים שלא נמצאים בו, ואל תשמיט אף אחד מהם.

## INPUTS

1. `REBUILD_SPEC.json` — המפרט המלא (ישויות, שדות, מסכים, עיצוב, API, ביצועים).
2. הפרומט הזה — סדר הבנייה, החוקים, וקבצי ה-config.

## HARD RULES (אסור לחרוג)

1. **RTL + עברית** בכל הממשק. `dir="rtl" lang="he"`. גופן Rubik.
2. **עיצוב מדויק** לפי `designSystem` ב-spec — Tailwind utility classes בלבד, ה-`componentRecipes` מילה במילה. אין CSS מותאם מלבד רקע/טקסט בסיס.
3. **חוק הביצועים מס' 1:** שדות תמונה (base64) לעולם לא נשלחים ברשימות/collection reads. הם נטענים רק כשנפתח מודל פרטים של רשומה בודדת. הפרה של זה = כישלון.
4. **שכבת נתונים אחת (`repository`)** — כל הרכיבים קוראים רק דרך `dataRepositoryInterface` שב-spec. מאחוריה מתחלף adapter: `JSONAdapter` (שלב 1) ⇄ `MongoAdapter` (שלב 2) — בלי לגעת ברכיב אחד.
5. **בידוד דיירים:** כל ישות מקושרת ל-`tenantId`. ולידציה מול registry (`^[a-z0-9]+$` + קיום). שום דבר לא חוצה דיירים.
6. **TypeScript קפדני.** הטיפוסים נגזרים ישירות מ-`dataModel` ב-spec.
7. **דחיסת תמונות בצד-לקוח:** לפני שמירה, כווץ כל תמונה ל-WebP עם canvas (קצה ארוך ≤1280px, איכות ~0.7).

## BUILD ORDER — בנה שלב-אחר-שלב. אחרי כל שלב עצור, הרץ את ה-SELF-CHECK, ותקן עד שהוא עובר. אל תתחיל שלב לפני שהקודם ירוק.

**Phase 0 — Scaffold**
צור פרויקט Vite + React + TS. הוסף Tailwind v4, react-router-dom, lucide-react. הדבק את קבצי ה-CONFIG למטה כמו שהם. הגדר גופן Rubik ו-`dir="rtl"` ב-`index.html`.
SELF-CHECK: `npm run dev` עולה, מסך ריק עם רקע `#f8fafc`, בלי שגיאות קונסול.

**Phase 1 — Types + Repository seam**
צור `src/types.ts` (כל הישויות מ-`dataModel`). צור `src/data/repository.ts` — ה-interface מ-`dataRepositoryInterface`. צור `src/data/jsonAdapter.ts` שמממש אותו מעל `seed.json` + localStorage (או @vercel/kv בפרודקשן). צור `src/data/index.ts` שמייצא instance אחד.
SELF-CHECK: אפשר לקרוא ל-`getTenants()`, `getCustomers(t)` וכו' ולקבל דאטה מה-seed. אף רכיב עדיין לא נכתב.

**Phase 2 — Design primitives**
צור רכיבים משותפים לפי `componentRecipes`: `Panel`, `PrimaryButton`, `IconButton`, `DangerButton`, `Input`, `Field` (label מעל), `StatusSelect`, `Modal` (Wrapper/Box/Header/Body/Footer), `Table` (Head/Row/Cell), `StatTile`, `Badge`.
SELF-CHECK: דף sandbox שמציג את כולם — צבעים/רדיוסים/צללים תואמים ל-`designSystem`.

**Phase 3 — Routing + tenant guard**
הגדר את כל ה-routes מ-`screens` (‎/:tenantId/admin, /:tenantId/portal/:id, /:tenantId/request/:id, /:tenantId/form, /:tenantId/driver, /:tenantId/driver/:token, /supadmin). הוסף guard שבודק `tenantExists`. הוסף `vercel.json` rewrite ל-SPA.
SELF-CHECK: כל route נטען (עדיין placeholders), tenant לא-קיים חוסם.

**Phase 4 — Super-Admin console** (`screens.superAdminConsole`)
Login (email+password), טבלת tenants, יצירת tenant, reveal/edit password, קישור אדמין + WhatsApp.
SELF-CHECK: יצירת tenant מוסיפה שורה; המזהה עובר ולידציה `^[a-z0-9]+$`.

**Phase 5 — Admin auth + shell** (`screens.adminLogin` + `adminDashboard` layout/nav)
מסך סיסמה, session cookie, sidebar עם 6 nav items + מודל הגדרות (drawer במובייל).
SELF-CHECK: התחברות פותחת את ה-shell; ה-nav מחליף טאבים; הפריט הפעיל `bg-gray-900 text-white`.

**Phase 6 — Admin tabs, אחד-אחד (בדוק אחרי כל טאב):**
6a `requests` — stat tiles, חיפוש/פילטר, טבלה (כל 9 העמודות), status/driver selects, פעולות שורה, מודל פרטים (טעינת תמונות on-demand).
6b `customers` — טבלה, region select, add/edit modals (כל השדות), פעולות (WhatsApp/QR/Waze/portal/delete).
6c `drivers` — רשימה, add form, קישור אישי/מחיקה.
6d `partRequests` — רשימה, toggle סטטוס, מחיקה.
6e `orders` — רשימה, create modal (customer search + deviceType+custom + quantity + unitPrice + ולידציות), status/driver selects.
6f `dispatch` — פאנל לכל אזור, קיבוץ לפי נהג, פריטים (request/order/part) עם selects.
SELF-CHECK לכל טאב: כל השדות/פעולות מה-spec קיימים; רשימות לא מושכות base64.

**Phase 7 — Public repair form** (`screens.publicRepairForm`)
כל השדות לפי הסדר, radio-cards ל-repairLevel, preApprovedAmount מותנה, warranty מותנה, העלאת תמונות מרובה + דחיסה, checkbox דמי בדיקה, מסך הצלחה.
SELF-CHECK: שליחה יוצרת ServiceRequest בסטטוס NEW; תמונות נדחסות ל-WebP.

**Phase 8 — Customer portal** (`screens.customerPortal`)
טאב קריאות (stats/חיפוש/פילטר/מודל פרטים/מודל קריאה חדשה), טאב בקשות חלקים (היסטוריה/מודל חדש/wa.me forward/מחיקה עם partsDeletePassword), אזור QR.
SELF-CHECK: כל הזרימות עובדות; מחיקת חלק דורשת סיסמה.

**Phase 9 — Driver panel** (`screens.driverPanel` + `driverIndex`)
כניסה בטוקן, קבוצות סטטוס, בחירה מרובה, טופס מסירה דיגיטלי (הערות פר-קריאה, שם חותם, canvas חתימה→base64, תמונה אופציונלית), מעבר ל-PICKED_UP_BY_DRIVER.
SELF-CHECK: חתימה + שם + בחירה מסמנים כ"נאסף".

**Phase 10 — Serverless API + polish**
עטוף את ה-repository ב-Vercel functions לפי `apiEndpoints`. הוסף CSRF + rate-limit על login/mutations. lazy-loading לתמונות. pagination לקריאות.
SELF-CHECK: `npm run build` נקי; deploy ל-Vercel; רשימות מהירות בלי base64.

**Phase 11 — Mongo swap (הוכחת מושג)**
צור `MongoAdapter` עם אותן חתימות; החלף ב-`index.ts` דרך env flag. אל תשנה שום רכיב.
SELF-CHECK: החלפת ה-flag מריצה את אותה אפליקציה מול Mongo.

## SELF-CHECK LOOP (הרץ בסוף כל שלב)
1. `npm run build` — אפס שגיאות TS.
2. השווה מול ה-spec: כל שדה/label/placeholder/פעולה של השלב קיים ובעברית?
3. עיצוב תואם `componentRecipes`?
4. שום list read לא כולל base64?
5. אם משהו נכשל — תקן לפני התקדמות. **אל תדלג.**

## DEFINITION OF DONE
כל הפריטים ב-`acceptanceCriteria` שב-spec מסומנים ✓, האפליקציה עולה ב-Vercel, וכל 7 המסכים עובדים מקצה לקצה ב-RTL עברית.

---

## CONFIG FILES — הדבק כמו שהם

### package.json (deps)
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.28.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

### vite.config.ts
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()] });
```

### src/index.css
```css
@import "tailwindcss";
:root { --background:#f8fafc; --foreground:#0f172a; }
body { background:var(--background); color:var(--foreground); font-family:'Rubik',sans-serif; }
```

### index.html (head)
```html
<html lang="he" dir="rtl">
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;700;900&display=swap" rel="stylesheet">
```

### vercel.json (SPA rewrite)
```json
{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }
```

### ENV
```
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD=
SESSION_SECRET=
MONGODB_URI=            # שלב 2 בלבד
# שלב 1 בפרודקשן: KV_REST_API_URL / KV_REST_API_TOKEN (‎@vercel/kv‎) — לא כותבים לקובץ בזמן ריצה ב-Vercel
```
