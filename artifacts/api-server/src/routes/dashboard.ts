import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { customersTable, paymentsTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res) => {
  try {
    // 1. חישוב תשלומים והכנסה
    const paymentStats = await db.select({
      totalRevenue: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)`,
      paymentCount: sql<string>`count(${paymentsTable.id})`,
    }).from(paymentsTable);

    // 2. חישוב כמות לקוחות
    const customerStats = await db.select({
      customerCount: sql<string>`count(${customersTable.id})`,
    }).from(customersTable);

    // 3. שליפת תשלומים אחרונים
    const recent = await db.select({
      id: paymentsTable.id,
      customerId: paymentsTable.customerId,
      customerName: customersTable.name,
      amount: paymentsTable.amount,
      reason: paymentsTable.reason,
      paidAt: paymentsTable.paidAt,
    })
    .from(paymentsTable)
    .innerJoin(customersTable, eq(customersTable.id, paymentsTable.customerId))
    .orderBy(desc(paymentsTable.paidAt))
    .limit(8);

    const totalRev = paymentStats[0]?.totalRevenue ?? "0";
    const payCount = paymentStats[0]?.paymentCount ?? "0";
    const custCount = customerStats[0]?.customerCount ?? "0";

    return res.json({
      totalRevenue: Number(totalRev),
      customerCount: Number(custCount),
      paymentCount: Number(payCount),
      recentPayments: (recent || []).map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    });
  } catch (error: any) {
    console.error("DASHBOARD ROUTE ERROR:", error);
    // מחזיר את הודעת השגיאה המדויקת של מסד הנתונים ישירות לדפדפן במקום 500 גנרי
    return res.status(500).json({
      error: "Database query failed",
      message: error.message,
      detail: error.detail,
      code: error.code,
    });
  }
});

export default router;
