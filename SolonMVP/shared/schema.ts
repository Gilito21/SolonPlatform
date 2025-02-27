import { pgTable, text, serial, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tokenPrices = pgTable("token_prices", {
  id: serial("id").primaryKey(),
  price: numeric("price").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  amount: numeric("amount").notNull(),
  price: numeric("price").notNull(),
  symbol: text("symbol").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).pick({
  type: true,
  amount: true,
  price: true,
  symbol: true,
}).extend({
  type: z.enum(["buy", "sell"]),
  amount: z.number().positive(),
  price: z.number().positive(),
  symbol: z.string().min(1),
});

export const waitlistSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type TokenPrice = typeof tokenPrices.$inferSelect;