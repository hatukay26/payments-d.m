import { Router, type IRouter, type Request, type Response } from "express";
import { asc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { customersTable, paymentsTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/customers", async (_req: Request, res: Response): Promise<void> => {
  try {
    const customers = await db.select().from(customersTable).orderBy(asc(customersTable.name));

    const paymentsAgg = await db.select({
      customerId: paymentsTable.customerId,
      totalPaid: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)`,
      paymentCount: sql<string>`count(${paymentsTable.id})`,
    })
    .from(paymentsTable)
    .groupBy(paymentsTable.customerId);

    const statsMap = new Map<number, { totalPaid: number; paymentCount: number }>();
    for (const p of paymentsAgg) {
      if (p.customerId) {
        statsMap.set(p.customerId, {
          totalPaid: Number(p.totalPaid),
          paymentCount: Number(p.paymentCount),
        });
      }
    }

    const result = customers.map((c) => {
      const stats = statsMap.get(c.id) || { totalPaid: 0, paymentCount: 0 };
      return {
        id: c.id,
        ownerId: c.ownerId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        notes: c.notes,
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        totalPaid: stats.totalPaid,
        paymentCount: stats.paymentCount,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error("CUSTOMERS GET ERROR:", error);
    res.status(500).json({
      error: "Failed to fetch customers",
      message: error?.message,
    });
  }
});

router.post("/customers", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, email, notes, ownerId } = req.body;
    const [newCustomer] = await db.insert(customersTable).values({
      name,
      phone,
      email,
      notes,
      ownerId,
    }).returning();

    res.status(201).json({
      ...newCustomer,
      createdAt: newCustomer.createdAt ? new Date(newCustomer.createdAt).toISOString() : new Date().toISOString(),
      totalPaid: 0,
      paymentCount: 0,
    });
  } catch (error: any) {
    console.error("CUSTOMERS CREATE ERROR:", error);
    res.status(500).json({
      error: "Failed to create customer",
      message: error?.message,
    });
  }
});

export default router;
