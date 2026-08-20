import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { customersTable, paymentsTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res, next) => {
  try {
    const [{ totalRevenue, paymentCount }] = await db.select({
      totalRevenue: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)`,
      paymentCount: sql<number>`count(${paymentsTable.id})`,
    }).from(paymentsTable);
    const [{ customerCount }] = await db.select({
      customerCount: sql<number>`count(${customersTable.id})`,
    }).from(customersTable);
    const recent = await db.select({
      id: paymentsTable.id,
      customerId: paymentsTable.customerId,
      customerName: customersTable.name,
      amount: paymentsTable.amount,
      reason: paymentsTable.reason,
      paidAt: paymentsTable.paidAt,
    }).from(paymentsTable).innerJoin(customersTable, eq(customersTable.id, paymentsTable.customerId))
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