import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Error handler שמחזיר את שגיאת מסד הנתונים המדויקת לדפדפן
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("SERVER / DB ERROR DETAILS:", err);
  res.status(500).json({
    message: err.message,
    code: err.code,
    detail: err.detail,
    hint: err.hint,
    schema: err.schema,
    table: err.table,
    column: err.column,
  });
});

export default app;
