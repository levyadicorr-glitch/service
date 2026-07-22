# מדריך עיצוב — WiseWheel Admin

מחולץ ישירות מהקוד הקיים (`src/app/[tenantId]/admin/AdminDashboard.tsx`) — לא המצאה, אלא תיעוד מדויק של מה שכבר קיים ורץ. המטרה: לשכפל בדיוק את אותו מראה בסביבת Python + Jinja2 (Flask/Django).

התשתית: **Tailwind CSS**. אין CSS מותאם אישית — הכל utility classes. כדי לשכפל את המראה בפרויקט Jinja צריך Tailwind זמין (CDN להדגמה, build אמיתי לפרודקשן — ר' `templates/base.html`).

## שפה וכיוון

- `dir="rtl"`, `lang="he"` — כל האתר RTL.
- גופן: **Rubik** (Google Fonts), משקלים `300 400 500 700 900`, subsets `hebrew,latin`.
- רקע הדף: `#f5f5f7`. צבע טקסט בסיס: `#1d1d1f`.

## פלטת צבעים

| תפקיד | צבע Tailwind | שימוש |
|---|---|---|
| רקע דף | `bg-[#f5f5f7]` | `<body>`/`<html>` |
| פאנלים/כרטיסים | `bg-white/80` + `backdrop-blur-md` | כל כרטיס תוכן |
| מודלים | `bg-white` (אטום) | תוכן המודל עצמו |
| טקסט ראשי | `text-gray-800` | טקסט גוף |
| טקסט כותרות/הדגשה | `text-gray-900` | כותרות, שמות |
| טקסט משני | `text-gray-500` / `text-gray-600` | תוויות, מטא-דאטה |
| טקסט מוחלש | `text-gray-400` | placeholder, טקסט עזר |
| גבולות עדינים | `border-gray-100` / `border-gray-200` | כל הגבולות הרגילים |
| מיתוג/CTA ראשי | גרדיאנט `from-blue-600 to-indigo-600` (hover: `from-blue-700 to-indigo-700`) | כפתורי פעולה ראשיים |
| הצלחה / הושלם / סופק | `bg-green-50 text-green-600/700 border-green-100` | סטטוסים חיוביים |
| ממתין / אזהרה | `bg-amber-50 text-amber-600/700 border-amber-100` | סטטוסים בתהליך |
| מידע / שיוך | `bg-blue-50 text-blue-600 border-blue-100` וגם `bg-cyan-50/70 text-cyan-700 border-cyan-100` (שיוך נהג) | badges אינפורמטיביים |
| מחיקה / ביטול / שגיאה | `bg-red-50 text-red-600 border-red-100/50` | כפתורי מחיקה, ביטול |
| ניטרלי/בוטל | `bg-gray-100 text-gray-500 border-gray-200` | סטטוס "בוטל" וכו' |
| ייחודי/מיוחד | `bg-purple-50 text-purple-600 border-purple-100` | תגיות מיוחדות |

**כלל אצבע לצבעי סטטוס**: תמיד השילוש `bg-{color}-50 text-{color}-600 (או 700) border-{color}-100`, אף פעם לא צבעים מלאים (500/600) כרקע של badge — רק כרקע גרדיאנט של כפתור ראשי.

## טיפוגרפיה — סקאלה בפועל (לפי שכיחות שימוש)

| Class | פיקסלים | שימוש |
|---|---|---|
| `text-[9px]` / `text-[10px]` | 9-10px | badges זעירים, timestamps |
| `text-xs` | 12px | **ברירת המחדל** — labels, badges, כפתורים משניים |
| `text-sm` | 14px | טקסט גוף רגיל, inputs |
| `text-base` | 16px | נדיר, טקסט מודגש בינוני |
| `text-lg` / `text-xl` | 18-20px | כותרות מודלים |
| `text-2xl` / `text-3xl` | 24-30px | מספרי סטטיסטיקה (stat tiles) |

משקלים: `font-bold` (הכי נפוץ — כמעט כל טקסט מודגש), `font-black` (כותרות/מספרים בולטים), `font-semibold`/`font-medium` (משניים), `font-mono` (מספרי טלפון, מחירים, כל מה שצריך יישור טורי).

## רדיוסים (border-radius) — סקאלה קשיחה

| Class | פיקסלים | מתי |
|---|---|---|
| `rounded-lg` | 8px | כפתורי אייקון קטנים בתוך שורות טבלה |
| `rounded-xl` | 12px | **ברירת מחדל** — inputs, selects, כפתורים, badges |
| `rounded-2xl` | 16px | פריטי רשימה (list items), תתי-כרטיסים |
| `rounded-3xl` | 24px | פאנלים ראשיים, מודלים |
| `rounded-full` | עגול מלא | אווטארים, פילס עגולים לגמרי |

**לעולם לא לערבב רדיוסים בין רמות** — אלמנט ברמת "פאנל" תמיד `rounded-3xl`, ברמת "כרטיסון בתוך פאנל" תמיד `rounded-2xl`, ברמת "שדה/כפתור" תמיד `rounded-xl`.

## צללים (shadows)

| Class | מתי |
|---|---|
| `shadow-[0_8px_30px_rgb(0,0,0,0.02)]` | הצל הסטנדרטי של כל כרטיס/פאנל — עדין מאוד |
| `shadow-sm` | אלמנטים קטנים (כפתורי אייקון, badges) |
| `shadow-md` / `shadow-lg` | כפתורי CTA ראשיים |
| `shadow-2xl` | מודלים |
| `shadow-blue-500/10` או `/20` | צל **צבעוני** על כפתור גרדיאנט (לא צל שחור!) |

## מרווחים (spacing)

- ריפוד פאנל: `p-6` (רגיל) / `p-4` (קומפקטי, למשל header עם חיפוש).
- ריפוד input/select: `px-4 py-3` (שדות טופס), `px-3 py-1.5` (selects/pills בתוך שורות).
- מרווח בין אלמנטים בשורה: `gap-2` / `gap-3` (רגיל), `gap-1.5` (קומפקטי, קבוצת כפתורי פעולה).
- מרווח אנכי בין קבוצות שדות: `space-y-4`.

## אפקטים אוניברסליים

- **כל** אלמנט אינטראקטיבי: `transition-all` (או `transition-colors` לצבע בלבד).
- **כל** כפתור: `active:scale-[0.98]` (משוב לחיצה) + `cursor-pointer`.
- **כל** input/select: `focus:outline-none focus:ring-2 focus:ring-blue-500/20` (טבעת פוקוס כחולה שקופה, לא outline דפדפן).
- זכוכית (glassmorphism): `bg-white/80 backdrop-blur-md` לפאנלים, `bg-white/95 backdrop-blur-xl` למגירת ניווט מובייל.
- Overlay/backdrop של מודל: `bg-black/40 backdrop-blur-sm`.

## דפוסי רכיבים (Component Recipes)

### כרטיס/פאנל
```
bg-white/80 backdrop-blur-md rounded-3xl border border-white/60
shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6
```

### כפתור ראשי (CTA)
```
px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600
hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl
text-xs font-bold flex items-center justify-center gap-2
shadow-lg shadow-blue-500/10 transition-all active:scale-[0.98] cursor-pointer
```

### כפתור משני (אייקון)
```
p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl
border border-gray-200 transition-all active:scale-[0.98] cursor-pointer
```

### כפתור מחיקה/סכנה
```
p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl
border border-red-100/50 transition-all active:scale-[0.98] cursor-pointer
```

### שדה טופס (input)
```
w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50
focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white
text-gray-800 text-sm transition-all
```
תווית תמיד מעל השדה (לא placeholder-only): `<label class="block text-gray-700 text-xs font-bold mb-1.5">`.

### Select צבעוני (סטטוס)
```
px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer
focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all
{bg-<color>-50} {text-<color>-600} {border-<color>-100}
```

### מודל
```
<!-- עטיפה: -->
fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto

<!-- תיבת המודל: -->
bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100
flex flex-col overflow-hidden

<!-- header: -->
p-6 border-b border-gray-100 flex items-center justify-between
<!-- body: -->
p-6 space-y-4 max-h-[65vh] overflow-y-auto
<!-- footer (אופציונלי): -->
p-5 bg-gray-50/70 border-t border-gray-100 flex justify-end
```

### שורת טבלה
```
<!-- <tr>: -->
hover:bg-gray-50/50 transition-colors
<!-- <th> (header): -->
p-5 (בתוך thead עם bg-gray-50/50 text-gray-400 font-bold text-xs uppercase tracking-wider border-b border-gray-200/50)
<!-- <td>: -->
p-5
```

### Stat Tile (תגית מספר)
מספר ב-`text-2xl` או `text-3xl font-black`, תווית מתחת ב-`text-xs text-gray-500 font-bold`, בתוך כרטיס קטן `rounded-2xl border p-4`.

## אייקונים

ספריית [Lucide](https://lucide.dev) בלבד (`lucide-react` בצד ה-React; יש גם [lucide static/SVG](https://lucide.dev/icons) שאפשר להטמיע ישירות ב-Jinja). **לעולם לא אמוג'י כאייקון**. גודל אחיד: `w-4 h-4` (16px) לרוב, `w-3.5 h-3.5` (14px) בתוך badges קומפקטיים, `w-5 h-5` (20px) בכותרות מודלים.

## עקרון מנחה

כל class הוא utility בודד מ-Tailwind הרגיל — **אין** קונפיגורציית צבעים מותאמת אישית מלבד `#f5f5f7`/`#1d1d1f` (רקע/טקסט בסיס). כלומר: אפשר לשכפל את המראה ב-100% דיוק עם Tailwind CDN רגיל + הקלאסים בדיוק כפי שמופיעים כאן, בלי שום קונפיגורציה נוספת.
