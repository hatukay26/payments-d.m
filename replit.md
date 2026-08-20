# ניהול תשלומי לקוחות

מערכת RTL אישית לרישום תשלומים, חיפוש לקוחות ומעקב אחר היסטוריית תשלומים.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/client-payments/src/App.tsx` — מסכי לוח הבקרה, לקוח בודד וטפסי הוספה.
- `artifacts/client-payments/src/index.css` — העיצוב, צבעי המותג והתאמות RTL.
- `artifacts/api-server/src/routes/` — נתיבי הלקוחות, התשלומים וסיכום לוח הבקרה.
- `lib/db/src/schema/customers.ts` — טבלאות הלקוחות והתשלומים.
- `lib/api-spec/openapi.yaml` — חוזה ה-API ומקור האמת ליצירת ה-hooks.

## Architecture decisions

- הנתונים נשמרים ב-PostgreSQL דרך Drizzle, כדי לשרוד רענון ולתמוך בהרחבות עתידיות.
- מחוללי ה-API מייצרים hooks ל-React Query, והמסכים מרעננים רשימות וסיכומים לאחר כל שינוי.
- האפליקציה משתמשת בנתיבי API יחסיים תחת `/api`, בהתאם לניתוב הפרוקסי של סביבת העבודה.

## Product

לוח בקרה מציג הכנסות, מספר לקוחות ותשלומים אחרונים; המשתמש יכול לחפש לקוחות, להוסיף או לערוך לקוח, למחוק אותו, ולרשום לכל לקוח תשלום עם סכום, סיבה, תאריך והערה.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- לאחר שינוי ב-`lib/api-spec/openapi.yaml` יש להריץ codegen לפני typecheck של האפליקציה.
- תהליכי העבודה המנוהלים הם מקור ההרצה של ה-API ושל ה-web; לא להפעיל שרת dev מהשורש.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
