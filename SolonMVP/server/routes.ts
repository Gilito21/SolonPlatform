import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, waitlistSchema } from "@shared/schema";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/prices/latest", async (_req, res) => {
    const price = await storage.getLatestPrice();
    res.json(price);
  });

  app.get("/api/prices/history", async (req, res) => {
    const timeframe = req.query.timeframe as string || '24H';
    const prices = await storage.getPriceHistory(timeframe);
    res.json(prices);
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(orderData);
      res.json(order);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: "Invalid order data" });
        return;
      }
      throw error;
    }
  });

  app.get("/api/orders", async (_req, res) => {
    const orders = await storage.getOrders();
    res.json(orders);
  });

  app.get("/api/portfolio", async (_req, res) => {
    const portfolio = await storage.getPortfolio();
    res.json(portfolio);
  });

  app.post("/api/waitlist", async (req, res) => {
    try {
      const { email } = waitlistSchema.parse(req.body);
      const result = await storage.addToWaitlist(email);
      
      if (!result) {
        res.status(409).json({ success: false, message: "Email already on waitlist" });
        return;
      }
      
      res.json({ success: true, message: "Added to waitlist" });
    } catch (error) {
      console.error("Waitlist error:", error);
      
      if (error instanceof ZodError) {
        res.status(400).json({ success: false, message: "Invalid email address" });
        return;
      }
      
      res.status(500).json({ success: false, message: "Failed to add to waitlist" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}