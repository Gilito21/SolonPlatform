import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis, // Import ZAxis
  Label, // Import Label
  Cell,
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function Portfolio() {
  const queryClient = useQueryClient();

  const { data: portfolio, isLoading: portfolioLoading, error: portfolioError } = useQuery<{ balance: number }>({
    queryKey: ["/api/portfolio"],
  });

  const { data: orders, isLoading: ordersLoading, error: ordersError } = useQuery<any[]>({
    queryKey: ["/api/orders"],
  });

  // Calculate token quantities from orders
  const tokenQuantities: Record<string, number> =
    orders?.reduce((acc: Record<string, number>, order: { symbol: string; amount: string; type: string; }) => {
      const amount = parseFloat(order.amount);
      if (!acc[order.symbol]) {
        acc[order.symbol] = 0;
      }
      // Track the actual token quantities
      acc[order.symbol] += order.type === "buy" ? amount : -amount;
      return acc;
    }, {}) || {};

  // (New) Calculate net cost (for cost basis)
  // We'll track total cost in 'tokenCostData[symbol].cost'
  // and net quantity in 'tokenCostData[symbol].quantity'
  const tokenCostData: Record<
    string,
    { symbol: string; cost: number; quantity: number }
  > = {};

  orders?.forEach((order: any) => {
    const symbol = order.symbol;
    const amount = parseFloat(order.amount);
    const price = parseFloat(order.price || "0");

    if (!tokenCostData[symbol]) {
      tokenCostData[symbol] = {
        symbol,
        cost: 0,
        quantity: 0,
      };
    }

    const costChange = price * amount;
    if (order.type === "buy") {
      tokenCostData[symbol].cost += costChange;
      tokenCostData[symbol].quantity += amount;
    } else {
      // For sells, subtract cost and reduce quantity
      tokenCostData[symbol].cost -= costChange;
      tokenCostData[symbol].quantity -= amount;
    }
  });

  // Get latest price to calculate current token values
  // (In a real app, you'd likely have a price per token.)
  const { data: latestPrice, isLoading: priceLoading, error: priceError } = useQuery<{ price: string }>({
    queryKey: ["/api/prices/latest"],
  });
  const currentPrice = parseFloat(latestPrice?.price || "0");

  // 1) Convert to PieChart data (as before)
  const tokenBalances = Object.entries(tokenQuantities).reduce(
    (acc: Record<string, number>, [symbol, quantity]) => {
      acc[symbol] = quantity * currentPrice;
      return acc;
    },
    {}
  );

  const portfolioData = Object.entries(tokenBalances)
    .filter(([_, value]) => value > 0)
    .map(([symbol, value], index) => ({
      name: symbol,
      value,
      color: COLORS[index % COLORS.length],
    }));

  // 2) Build data for the Cost-vs-Current-Value comparison chart
  //    We'll only include tokens with a positive quantity
  const costValueData = Object.values(tokenCostData)
    .filter((t) => t.quantity > 0) // Only show net holdings > 0
    .map((t, index) => {
      const currentVal = t.quantity * currentPrice;
      return {
        symbol: t.symbol,
        cost: t.cost,
        currentValue: currentVal,
        // difference: positive means gain, negative means loss
        difference: currentVal - t.cost,
      };
    });

  // Prepare data for the bubble chart
  const portfolioDataBubble = Object.entries(tokenQuantities)
    .filter(([_, quantity]) => quantity > 0) // Show only tokens with positive quantities
    .map(([symbol, quantity], index) => ({
      name: symbol,
      value: quantity * currentPrice, // Bubble size based on token value
      quantity: quantity, // Store quantity for tooltip
      color: COLORS[index % COLORS.length],
      x: Math.random(), // Random X position for distribution
      y: Math.random(), // Random Y position for distribution
      label: `${symbol} (${quantity.toFixed(2)})`, // Label with token name and quantity
    }));

  // Adjust bubble size based on the number of bubbles
  const bubbleCount = portfolioDataBubble.length;
  const baseSize = 5000; // Adjust this value to change the base size
  const sizeFactor = baseSize / (bubbleCount || 1); // Ensure no division by zero

  if (portfolioLoading || ordersLoading || priceLoading) {
    return <div>Loading...</div>;
  }

  if (portfolioError || ordersError || priceError) {
    return <div>Error loading data.</div>;
  }

  return (
    <div>
      {/* Spacer div to prevent overlap with the header */}
      <div style={{ height: '60px' }}></div>
    
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Portfolio</h1>
        <p className="text-muted-foreground">
          View your token holdings and transaction history
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Cash Balance:</span>
                <span className="text-xl font-medium">
                  ${portfolio?.balance?.toFixed(2) || "0.00"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Token Value:</span>
                <span className="text-xl font-medium">
                  {(
                    Object.entries(tokenQuantities).reduce(
                      (sum, [_, quantity]) => sum + quantity * currentPrice,
                      0
                    ) ?? 0
                  ).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                <span className="text-muted-foreground font-medium">
                  Total Portfolio Value:
                </span>
                <span className="text-xl font-bold text-primary">
                  {(
                    (portfolio?.balance || 0) +
                    Object.entries(tokenQuantities).reduce(
                      (sum, [_, quantity]) => sum + quantity * currentPrice,
                      0
                    )
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bubble Chart (Distribution) */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 30 }}>
                  <XAxis type="number" dataKey="x" name="X" unit="" tick={false} />
                  <YAxis type="number" dataKey="y" name="Y" unit="" tick={false} />
                  <ZAxis type="number" dataKey="value" name="Value" range={[100, sizeFactor]} />
                  <Tooltip
                    formatter={(value: any, name: any, props: any) => {
                      if (name === "value") {
                        return [`$${value.toFixed(2)}`, "Value"];
                      }
                      if (name === "quantity") {
                        return [props.payload.quantity.toFixed(2), "Quantity"];
                      }
                      return value;
                    }}
                    labelFormatter={(label: any) => `Token: ${label}`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Scatter
                    name="Tokens"
                    data={portfolioDataBubble}
                    fill="#8884d8"
                    shape="circle"
                  >
                    {portfolioDataBubble.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <Label
                      dataKey="label"
                      position="inside"
                      fill="#000"
                      fontSize={12}
                      fontWeight="bold"
                    />
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* NEW: Bar Chart (Cost Basis vs Current Value) */}
        <Card>
          <CardHeader>
            <CardTitle>Cost vs Market Value</CardTitle>
          </CardHeader>
          <CardContent>
            {costValueData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costValueData}>
                    <XAxis dataKey="symbol" />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) =>
                        name === "difference"
                          ? [`$${(value as number).toFixed(2)}`, "Profit/Loss"]
                          : [`$${(value as number).toFixed(2)}`, name]
                      }
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="cost" fill="#8884d8" name="Total Cost" />
                    <Bar
                      dataKey="currentValue"
                      fill="#82ca9d"
                      name="Current Value"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground">No token data to display.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(tokenQuantities).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(tokenQuantities)
                  .filter(([_, quantity]) => quantity > 0)
                  .map(([symbol, quantity]) => (
                    <div
                      key={symbol}
                      className="flex justify-between items-center p-2 border-b"
                    >
                      <div>
                        <span className="font-medium">{symbol}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-base">
                          {(quantity as number).toFixed(2)} tokens
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ${(quantity * currentPrice).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No tokens in your portfolio yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders
                ?.slice()
                .sort(
                  (a: any, b: any) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                )
                .map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <span
                        className={`font-medium ${
                          order.type === "buy" ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {order.type.toUpperCase()} {order.symbol}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.timestamp), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {order.amount} {order.symbol}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        @ ${parseFloat(order.price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              {(!orders || (orders as any[]).length === 0) && (
                <p className="text-center text-muted-foreground py-4">
                  No transactions yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
