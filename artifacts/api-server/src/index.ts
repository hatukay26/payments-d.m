import fs from "fs";
import path from "path";
import express from "express";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// בדיקת כל הנתיבים האפשריים שבהם Vite יכול לשמור את קבצי הפרונט-אנד
const possiblePaths = [
  path.resolve(process.cwd(), "../client-payments/dist"),
  path.resolve(process.cwd(), "../client-payments/dist/public"),
  path.resolve(process.cwd(), "../../client-payments/dist"),
  path.resolve(process.cwd(), "../../client-payments/dist/public"),
  path.resolve(process.cwd(), "dist/public"),
  path.resolve(process.cwd(), "public"),
];

const staticPath =
  possiblePaths.find((p) => fs.existsSync(path.join(p, "index.html"))) ||
  possiblePaths[0];

logger.info(
  { staticPath, exists: fs.existsSync(path.join(staticPath, "index.html")) },
  "Static files path configured",
);

// הגשת קבצים סטטיים של הפרונט-אנד
app.use(express.static(staticPath));

// אם קריאה מתחילה ב-/api ולא נמצאה - נחזיר תגובת JSON של 404 במקום להחזיר דף HTML ששובר את האתר
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// ניתוב כל בקשת עמוד רגילה אל ה-index.html של ה-React
app.use((_req, res) => {
  const indexPath = path.join(staticPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`index.html not found. Checked path: ${staticPath}`);
  }
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
