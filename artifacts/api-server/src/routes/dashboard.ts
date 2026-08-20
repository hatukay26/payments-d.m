import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import type { Request } from "express";
import { db } from "@workspace/db";
import { customersTable, paymentsTable } from "@workspace/db/schema";

const router: IRouter = Router();
type AuthenticatedRequest = Request & { userId?: string };
const requireAuth = (req: AuthenticatedRequest, res: any, next: any) => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
};
router.use(requireAuth);

router.get("/dashboard/summary", async (req, res, next) => {
  try {
    const ownerId = (req as AuthenticatedRequest).userId!;
    const [{ totalRevenue, paymentCount }] = await db.select({
      totalRevenue: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)`,
      paymentCount: sql<number>`count(${paymentsTable.id})`,
    }).from(paymentsTable).where(eq(paymentsTable.ownerId, ownerId));
    const [{ customerCount }] = await db.select({
      customerCount: sql<number>`count(${customersTable.id})`,
    }).from(customersTable).where(eq(customersTable.ownerId, ownerId));
    const recent = await db.select({
      id: paymentsTable.id,
      customerId: paymentsTable.customerId,
      customerName: customersTable.name,
      amount: paymentsTable.amount,
      reason: paymentsTable.reason,
      paidAt: paymentsTable.paidAt,
    }).from(paymentsTable).innerJoin(customersTable, and(eq(customersTable.id, paymentsTable.customerId), eq(customersTable.ownerId, ownerId), eq(paymentsTable.ownerId, ownerId)))
      .orderBy(desc(paymentsTable.paidAt), desc(paymentsTable.createdAt)).limit(8);
    res.json({
      totalRevenue: Number(totalRevenue),
      customerCount: Number(customerCount),
      paymentCount: Number(paymentCount),
      recentPayments: recent.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;