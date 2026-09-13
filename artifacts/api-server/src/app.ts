import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("SERVER / DB ERROR DETAILS:", err);
  res.status(500).json({
    message: err?.message || "Internal Server Error",
    code: err?.code,
    detail: err?.detail,
    hint: err?.hint,
    schema: err?.schema,
    table: err?.table,
    column: err?.column,
  });
});

export default app;
