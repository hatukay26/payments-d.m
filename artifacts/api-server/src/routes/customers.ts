import { Router, type IRouter } from "express";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { customersTable, paymentsTable } from "@workspace/db/schema";

const router: IRouter = Router();

// GET all customers with aggregated payments
router.get("/customers", async (_req, res) => {
  try {
    const customers = await db.select().from(customersTable).orderBy(asc(customersTable.name));

    // שליפת סך כל התשלומים לכל לקוח בנפרד בצורה פשוטה וחסינת שגיאות
    const paymentsAgg = await db.select({
      customerId: paymentsTable.customerId,
      totalPaid: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)`,
      paymentCount: sql<string>`count(${paymentsTable.id})`,
    })
    .from(paymentsTable)
    .groupBy(paymentsTable.customerId);

    const statsMap = new Map<number, { totalPaid: number; paymentCount: number }>();
    for (const p of paymentsAgg) {
      statsMap.set(p.customerId, {
        totalPaid: Number(p.totalPaid),
        paymentCount: Number(p.paymentCount),
      });
    }

    const result = customers.map((c) => {
      const stats = statsMap.get(c.id) || { totalPaid: 0, paymentCount: 0 };
      return {
        ...c,
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        totalPaid: stats.totalPaid,
        paymentCount: stats.paymentCount,
      };
    });

    return res.json(result);
  } catch (error: any) {
    console.error("CUSTOMERS GET ERROR:", error);
    return res.status(500).json({
      error: "Failed to fetch customers",
      message: error.message,
      detail: error.detail,
    });
  }
});

// POST new customer
router.post("/customers", async (req, res) => {
  try {
    const { name, phone, email, notes, ownerId } = req.body;
    const [newCustomer] = await db.insert(customersTable).values({
      name,
      phone,
      email,
      notes,
      ownerId,
    }).returning();

    return res.status(201).json({
      ...newCustomer,
      createdAt: newCustomer.createdAt ? new Date(newCustomer.createdAt).toISOString() : new Date().toISOString(),
      totalPaid: 0,
      paymentCount: 0,
    });
  } catch (error: any) {
    console.error("CUSTOMERS CREATE ERROR:", error);
    return res.status(500).json({
      error: "Failed to create customer",
      message: error.message,
    });
  }
});

export default router;
