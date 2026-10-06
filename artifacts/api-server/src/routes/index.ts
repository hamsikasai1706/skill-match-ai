import { Router, type IRouter } from "express";
import aiRouter from "./ai";
import authRouter from "./auth";
import insightsRouter from "./insights";
import jobsRouter from "./jobs";
import healthRouter from "./health";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(jobsRouter);
router.use(insightsRouter);
router.use(aiRouter);

export default router;
