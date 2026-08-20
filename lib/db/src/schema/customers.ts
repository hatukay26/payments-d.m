import { relations } from "drizzle-orm";
import { date, integer, numeric, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 240 }).notNull(),
  paidAt: date("paid_at").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const customersRelations = relations(customersTable, ({ many }) => ({
  payments: many(paymentsTable),
}));

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  customer: one(customersTable, {
    fields: [paymentsTable.customerId],
    references: [customersTable.id],
  }),
}));

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });

export type Customer = typeof customersTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type InsertCustomer = typeof customersTable.$inferInsert;
export type InsertPayment = typeof paymentsTable.$inferInsert;