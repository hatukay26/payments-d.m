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

// הגשת קבצי הפרונט-אנד הסטטיים
const staticPath = path.resolve(process.cwd(), "../client-payments/dist");
app.use(express.static(staticPath));

// ב-Express 5 משתמשים ב-fallback middleware לכל בקשה שאינה API
app.use((_req, res) => {
  res.sendFile(path.join(staticPath, "index.html"));
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
