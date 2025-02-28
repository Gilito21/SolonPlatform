import { type TokenPrice, type Order, type InsertOrder } from "@shared/schema";
import path from 'path';
import fs from 'fs';

export interface IStorage {
  getLatestPrice(): Promise<TokenPrice>;
  getPriceHistory(timeframe: string): Promise<TokenPrice[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  getOrders(): Promise<Order[]>;
  getPortfolio(): Promise<{ balance: number; value: number }>;
  addToWaitlist(email: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private prices: TokenPrice[];
  private orders: Order[];
  private currentId: number;
  private waitlistEmails: string[];

  constructor() {
    this.prices = this.generateMockPrices("24H");
    this.orders = [];
    this.currentId = 1;
    this.waitlistEmails = [];
  }

  private generateMockPrices(timeframe: string): TokenPrice[] {
    const prices: TokenPrice[] = [];
    const basePrice = 100;
    let dataPoints = 24;
    let hourOffset = 1;

    switch (timeframe) {
      case "1H":
        dataPoints = 60;
        hourOffset = 1 / 60; // 1 minute intervals
        break;
      case "7D":
        dataPoints = 168;
        hourOffset = 1;
        break;
      default: // 24H
        dataPoints = 24;
        hourOffset = 1;
    }

    for (let i = 0; i < dataPoints; i++) {
      const randomChange =
        (Math.random() - 0.5) * (timeframe === "1H" ? 2 : 10);
      const price = basePrice + randomChange;
      const timestamp = new Date();
      timestamp.setHours(
        timestamp.getHours() - (dataPoints - 1 - i) * hourOffset,
      );

      prices.push({
        id: i + 1,
        price: price.toString(),
        timestamp: timestamp,
      });
    }

    return prices;
  }

  async getLatestPrice(): Promise<TokenPrice> {
    return this.prices[this.prices.length - 1];
  }

  async getPriceHistory(timeframe: string = "24H"): Promise<TokenPrice[]> {
    this.prices = this.generateMockPrices(timeframe);
    return this.prices;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const order: Order = {
      ...insertOrder,
      id: this.currentId++,
      timestamp: new Date(),
      price: insertOrder.price.toString(),
      amount: insertOrder.amount.toString(),
    };
    this.orders.push(order);
    return order;
  }

  async getOrders(): Promise<Order[]> {
    return this.orders;
  }

  async getPortfolio(): Promise<{ balance: number; value: number }> {
    // Initialize with a starting balance of 1000
    let availableBalance = 1000;

    // Calculate token balances
    const tokenBalances = this.orders.reduce(
      (acc: Record<string, number>, order) => {
        const amount = parseFloat(order.amount);
        const price = parseFloat(order.price);
        const orderValue = amount * price;

        if (!acc[order.symbol]) {
          acc[order.symbol] = 0;
        }

        // Track token quantities
        acc[order.symbol] += order.type === "buy" ? amount : -amount;

        // Update available balance
        if (order.type === "buy") {
          availableBalance -= orderValue;
        } else {
          availableBalance += orderValue;
        }

        return acc;
      },
      {},
    );

    // Calculate current portfolio value
    const latestPrice = parseFloat(this.prices[this.prices.length - 1].price);
    const tokensValue = Object.values(tokenBalances).reduce(
      (sum, tokenAmount) => {
        return sum + tokenAmount * latestPrice;
      },
      0,
    );

    // Total value is available balance plus token values
    const value = availableBalance + tokensValue;

    return { balance: availableBalance, value };
  }

  async addToWaitlist(subscriberEmail: string): Promise<boolean> {
    if (this.waitlistEmails.includes(subscriberEmail)) {
      return false; // Email already in waitlist
    }

    this.waitlistEmails.push(subscriberEmail);
    console.log(`Added to waitlist: ${subscriberEmail}`);

    // Send notification email
    try {
      await this.sendNotificationEmail(subscriberEmail);
    } catch (error) {
      console.error("Failed to send notification email:", error);
      // Still return true since the email was added to the waitlist
    }

    return true;
  }

  private async sendNotificationEmail(subscriberEmail: string): Promise<void> {
    const nodemailer = await import("nodemailer");

    // Create a test account if no environment variables are set
    // For production, you should set these environment variables
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;
    const YOUR_EMAIL = process.env.YOUR_EMAIL || "waitlistsolon@gmail.com";
    const PERSONAL_EMAIL = process.env.PERSONAL_EMAIL;

    let transporter;

    if (!SMTP_USER || !SMTP_PASS) {
      // Create a test account for development
      console.log("Using test email account (ethereal.email)");
      const testAccount = await nodemailer.createTestAccount();

      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } else {
      // Use provided SMTP credentials
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });
    }

    const logoPath = path.join(__dirname, '../client/src/pages/Solon_White_logo.png');
    const logoData = fs.readFileSync(logoPath).toString('base64');

    // Send email to admin
    const info = await transporter.sendMail({
      from: '"Waitlist Notifier" <waitlist@Solon.com>',
      to: PERSONAL_EMAIL,
      subject: "New Waitlist Signup 🚀",
      text: `Someone new has joined the waitlist: ${subscriberEmail}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">New Waitlist Signup!</h2>
          <p style="font-size: 16px; line-height: 1.5;">Someone new has joined your waitlist:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="font-size: 18px; font-weight: bold; margin: 0; word-break: break-all;">${subscriberEmail}</p>
          </div>
          <p style="font-size: 14px; color: #777; text-align: center; margin-top: 30px;">
            This is an automated notification from your application.
          </p>
        </div>
      `,
    });

    // Send email to subscriber
    const info2 = await transporter.sendMail({
      from: '"Waitlist Notifier" <waitlist@Solon.com>',
      to: subscriberEmail,
      subject: "Thank you for joining our waitlist 🚀",
      text: `We will notify you as soon as Solon goes live: ${subscriberEmail}`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 40px; text-align: center;">
          <h1 style="color: #333; margin-bottom: 20px;">Welcome to <img src="cid:solonLogo" alt="Solon Logo" style="height: 40px;" /></h1>
          <p style="font-size: 16px; color: #555; margin-bottom: 30px;">
            Thank you for joining our waitlist. We’re thrilled to have you on board!
          </p>
          <div style="background: #fff; padding: 20px; display: inline-block; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 30px;">
            <p style="font-size: 18px; margin: 0; word-wrap: break-word;">
              <strong>Your email:</strong> ${subscriberEmail}
            </p>
          </div>
          <p style="font-size: 14px; color: #888;">
            We’ll let you know as soon as Solon goes live. In the meantime, keep an eye out!
          </p>
          <!-- Optional button or call to action -->
          <a 
            href="https://bba-01mw.onrender.com/" 
            style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #007BFF; color: #fff; border-radius: 4px; text-decoration: none; font-weight: bold;"
          >
            Visit Our Website
          </a>
          <p style="margin-top: 40px; font-size: 12px; color: #aaa;">
            This is an automated message from Solon. We’re excited to have you with us!
          </p>
        </div>
      `,
      attachments: [
        {
          filename: 'Solon_White_logo.png',
          content: logoData,
          encoding: 'base64',
          cid: 'solonLogo', // same cid value as in the html img src
        },
      ],
    });

    // If using ethereal email, log the preview URL
    if (!SMTP_USER || !SMTP_PASS) {
      console.log(
        "Email sent (preview URL): %s",
        nodemailer.getTestMessageUrl(info),
      );
    } else {
      console.log("Email notification sent to", YOUR_EMAIL);
    }
  }
}

export const storage = new MemStorage();
