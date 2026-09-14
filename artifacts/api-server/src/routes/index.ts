import express from "express";
import healthRouter from "./health.js";
import customersRouter from "./customers.js";

const router = express.Router();

router.use("/health", healthRouter);
router.use("/customers", customersRouter);

export default router;
