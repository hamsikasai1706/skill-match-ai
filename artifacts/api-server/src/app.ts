import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { HttpError } from "./lib/errors";

const app: Express = express();
const allowedOrigins = (process.env["CLIENT_URL"] ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);

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
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (process.env["NODE_ENV"] !== "production" && allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "The requested API route was not found." },
  });
});

app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = error instanceof HttpError ? error.status : 500;
    const code =
      error instanceof HttpError
        ? error.code
        : status === 500
          ? "INTERNAL_SERVER_ERROR"
          : "REQUEST_FAILED";
    const message =
      error instanceof HttpError
        ? error.message
        : status === 500
          ? "An unexpected server error occurred."
          : "The request could not be processed.";

    if (status >= 500) {
      req.log?.error(
        { code, errorType: error instanceof Error ? error.name : "unknown" },
        "API request failed",
      );
    }
    res.status(status).json({ success: false, error: { code, message } });
  },
);

export default app;
