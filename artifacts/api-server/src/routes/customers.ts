import { Router, type IRouter, type Request } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  CreateCustomerBody,
  CreatePaymentBody,
  GetCustomerParams,
  ListCustomersQueryParams,
  UpdateCustomerBody,
  UpdateCustomerParams,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { customersTable, paymentsTable } from "@workspace/db/schema";

const router: IRouter = Router();
type AuthenticatedRequest = Request & { userId?: string };
const requireAuth = async (req: AuthenticatedRequest, res: any, next: any) => {
  const auth = getAuth(req);
  const userId = String(auth?.sessionClaims?.userId || auth?.userId || "");
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  await db.update(customersTable).set({ ownerId: userId }).where(sql`${customersTable.ownerId} is null`);
  await db.update(paymentsTable).set({ ownerId: userId }).where(sql`${paymentsTable.ownerId} is null`);
  next();
};
router.use(requireAuth);
const toMoney = (value: string | number) => Number(value);
const customerSummary = (row: typeof customersTable.$inferSelect, totalPaid: string | number, paymentCount: number) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email,
  notes: row.notes,
  totalPaid: toMoney(totalPaid),
  paymentCount,
  createdAt: row.createdAt.toISOString(),
});

router.get("/customers", async (req, res, next) => {
  try {
    const ownerId = (req as AuthenticatedRequest).userId!;
    const query = ListCustomersQueryParams.parse(req.query);
    const search = query.search?.trim();
    const rows = await db
      .select({
        customer: customersTable,
        totalPaid: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)`,
        paymentCount: sql<number>`count(${paymentsTable.id})`,
      })
      .from(customersTable)
      .leftJoin(paymentsTable, eq(paymentsTable.customerId, customersTable.id))
      .where(search
        ? and(eq(customersTable.ownerId, ownerId), or(ilike(customersTable.name, `%${search}%`), ilike(customersTable.phone, `%${search}%`)))
        : eq(customersTable.ownerId, ownerId))
      .groupBy(customersTable.id)
      .orderBy(asc(customersTable.name));
    res.json(rows.map((row) => customerSummary(row.customer, row.totalPaid, Number(row.paymentCount))));
  } catch (error) {
    next(error);
  }
});

router.post("/customers", async (req, res, next) => {
  try {
    const ownerId = (req as AuthenticatedRequest).userId!;
    const body = CreateCustomerBody.parse(req.body);
    const [row] = await db.insert(customersTable).values({
      ownerId,
      name: body.name,
      phone: body.phone || null,
      email: body.email || null,
      notes: body.notes || null,
    }).returning();
    res.status(201).json(customerSummary(row, 0, 0));
  } catch (error) {
    next(error);
  }
});

router.get("/customers/:id", async (req, res, next) => {
  try {
    const ownerId = (req as AuthenticatedRequest).userId!;
    const { id } = GetCustomerParams.parse(req.params);
    const [row] = await db.select().from(customersTable).where(sql`${eq(customersTable.id, id)} and ${eq(customersTable.ownerId, ownerId)}`);
    if (!row) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    const payments = await db.select().from(paymentsTable).where(sql`${eq(paymentsTable.customerId, id)} and ${eq(paymentsTable.ownerId, ownerId)}`).orderBy(desc(paymentsTable.paidAt), desc(paymentsTable.createdAt));
    const totalPaid = payments.reduce((sum, payment) => sum + toMoney(payment.amount), 0);
    res.json({
      ...customerSummary(row, totalPaid, payments.length),
      payments: payments.map((payment) => ({
        ...payment,
        amount: toMoney(payment.amount),
        paidAt: payment.paidAt,
        createdAt: payment.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/customers/:id", async (req, res, next) => {
  try {
    const ownerId = (req as AuthenticatedRequest).userId!;
    const { id } = UpdateCustomerParams.parse(req.params);
    const body = UpdateCustomerBody.parse(req.body);
    const [row] = await db.update(customersTable).set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
      ...(body.email !== undefined ? { email: body.email || null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
    }).where(sql`${eq(customersTable.id, id)} and ${eq(customersTable.ownerId, ownerId)}`).returning();
    if (!row) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    const [{ totalPaid, paymentCount }] = await db.select({
      totalPaid: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)`,
      paymentCount: sql<number>`count(${paymentsTable.id})`,
    }).from(paymentsTable).where(sql`${eq(paymentsTable.customerId, id)} and ${eq(paymentsTable.ownerId, ownerId)}`);
    res.json(customerSummary(row, totalPaid, Number(paymentCount)));
  } catch (error) {
    next(error);
  }
});

router.delete("/customers/:id", async (req, res, next) => {
  try {
    const ownerId = (req as AuthenticatedRequest).userId!;
    const { id } = UpdateCustomerParams.parse(req.params);
    await db.delete(customersTable).where(sql`${eq(customersTable.id, id)} and ${eq(customersTable.ownerId, ownerId)}`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/payments", async (req, res, next) => {
  try {
    const ownerId = (req as AuthenticatedRequest).userId!;
    const body = CreatePaymentBody.parse(req.body);
    const [row] = await db.insert(paymentsTable).values({
      ownerId,
      customerId: body.customerId,
      amount: String(body.amount),
      reason: body.reason,
      paidAt: body.paidAt instanceof Date ? body.paidAt.toISOString().slice(0, 10) : body.paidAt,
      notes: body.notes || null,
    }).returning();
    res.status(201).json({
      ...row,
      amount: toMoney(row.amount),
      createdAt: row.createdAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;