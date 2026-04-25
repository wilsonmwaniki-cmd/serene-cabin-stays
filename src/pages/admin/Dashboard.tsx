import { useMemo } from "react";
import { format, parse } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { useAdminFinance } from "@/hooks/useAdminFinance";

const kes = (value: number) => `KES ${value.toLocaleString()}`;

const monthLabel = (value: string) => {
  try {
    return format(parse(value, "yyyy-MM", new Date()), "MMM yyyy");
  } catch {
    return value;
  }
};

const AdminDashboard = () => {
  const { summary, isLoading } = useAdminFinance();

  const chartData = useMemo(
    () =>
      summary.monthlyPerformance.map((entry) => ({
        ...entry,
        label: monthLabel(entry.month),
      })),
    [summary.monthlyPerformance],
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Finance</p>
        <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Revenue dashboard</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
          See confirmed booking revenue, pending revenue, affiliate-code performance, expenses, and your net position in one place.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Confirmed revenue" value={kes(summary.confirmedRevenue)} note="From approved bookings" />
        <MetricCard title="Pending revenue" value={kes(summary.pendingRevenue)} note="Still waiting for approval" />
        <MetricCard title="Total expenses" value={kes(summary.totalExpenses)} note="Everything logged so far" />
        <MetricCard title="Net position" value={kes(summary.netRevenue)} note="Confirmed revenue minus expenses" highlight={summary.netRevenue >= 0} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard title="Affiliate revenue" value={kes(summary.affiliateRevenue)} note="Confirmed revenue from affiliate codes" />
        <MetricCard title="Total discounts given" value={kes(summary.totalDiscounts)} note="All discounts applied across bookings" />
        <Card className="bg-bone/40 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-sage-deep">Expense split</CardTitle>
            <CardDescription>How your costs are spread today.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <SplitRow label="Cabins" value={kes(summary.expenseByArea.cabins)} />
            <SplitRow label="Restaurant" value={kes(summary.expenseByArea.restaurant)} />
            <SplitRow label="Shared overhead" value={kes(summary.expenseByArea.shared)} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="bg-bone/40 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-sage-deep">Revenue vs expenses</CardTitle>
            <CardDescription>Last 6 months based on confirmed stays and logged expenses.</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enough data yet.</p>
            ) : (
              <ChartContainer
                className="h-[280px] w-full"
                config={{
                  revenue: { label: "Revenue", color: "#6b7a5b" },
                  expenses: { label: "Expenses", color: "#c9734f" },
                }}
              >
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-bone/40 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-sage-deep">Top expense categories</CardTitle>
            <CardDescription>Where most of your money is going.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.expenseByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses logged yet.</p>
            ) : (
              summary.expenseByCategory.slice(0, 8).map((item) => (
                <SplitRow key={item.category} label={item.category} value={kes(item.total)} />
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-bone/40 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-sage-deep">Affiliate code performance</CardTitle>
            <CardDescription>Revenue from each affiliate code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.affiliateBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No confirmed affiliate bookings yet.</p>
            ) : (
              summary.affiliateBreakdown.map((item) => (
                <div key={item.code} className="flex items-center justify-between gap-4 border border-border/50 rounded-md px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sage-deep">{item.code}</p>
                      <Badge variant="secondary">{item.bookings} booking{item.bookings === 1 ? "" : "s"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Confirmed revenue from this affiliate.</p>
                  </div>
                  <p className="font-medium">{kes(item.revenue)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-bone/40 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-sage-deep">Recent confirmed bookings</CardTitle>
            <CardDescription>Latest approved stays contributing to revenue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.recentConfirmedBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No confirmed bookings yet.</p>
            ) : (
              summary.recentConfirmedBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between gap-4 border border-border/50 rounded-md px-4 py-3">
                  <div>
                    <p className="font-medium text-sage-deep">{booking.guest_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {booking.pod_name} · {format(new Date(booking.check_in), "MMM d")} to {format(new Date(booking.check_out), "MMM d, yyyy")}
                    </p>
                  </div>
                  <p className="font-medium">{kes(booking.total_kes ?? 0)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

const MetricCard = ({
  title,
  value,
  note,
  highlight,
}: {
  title: string;
  value: string;
  note: string;
  highlight?: boolean;
}) => (
  <Card className="bg-bone/40 border-border/60">
    <CardHeader className="pb-3">
      <CardDescription>{title}</CardDescription>
      <CardTitle className={`font-display text-3xl ${highlight === false ? "text-ember" : "text-sage-deep"}`}>{value}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">{note}</p>
    </CardContent>
  </Card>
);

const SplitRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 border border-border/50 rounded-md px-4 py-3">
    <span className="text-sm text-foreground/80">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
);

export default AdminDashboard;
