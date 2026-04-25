import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAdminBookings } from "@/hooks/useAdminBookings";

export type ExpenseItem = Tables<"expenses">;

const monthKey = (value: string) => value.slice(0, 7);

export const useAdminExpenses = () =>
  useQuery({
    queryKey: ["admin_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExpenseItem[];
    },
  });

export const useAdminFinance = () => {
  const bookingsQuery = useAdminBookings();
  const expensesQuery = useAdminExpenses();

  const summary = useMemo(() => {
    const bookings = bookingsQuery.data ?? [];
    const expenses = expensesQuery.data ?? [];

    const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed");
    const pendingBookings = bookings.filter((booking) => booking.status === "pending");
    const affiliateBookings = confirmedBookings.filter(
      (booking) => booking.promo_code_kind === "affiliate" && booking.promo_code_text,
    );

    const confirmedRevenue = confirmedBookings.reduce((sum, booking) => sum + (booking.total_kes ?? 0), 0);
    const pendingRevenue = pendingBookings.reduce((sum, booking) => sum + (booking.total_kes ?? 0), 0);
    const affiliateRevenue = affiliateBookings.reduce((sum, booking) => sum + (booking.total_kes ?? 0), 0);
    const totalDiscounts = bookings.reduce((sum, booking) => sum + (booking.discount_kes ?? 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount_kes, 0);
    const netRevenue = confirmedRevenue - totalExpenses;

    const expenseByArea = {
      cabins: expenses.filter((expense) => expense.business_area === "cabins").reduce((sum, expense) => sum + expense.amount_kes, 0),
      restaurant: expenses.filter((expense) => expense.business_area === "restaurant").reduce((sum, expense) => sum + expense.amount_kes, 0),
      shared: expenses.filter((expense) => expense.business_area === "shared").reduce((sum, expense) => sum + expense.amount_kes, 0),
    };

    const affiliateBreakdown = Object.values(
      affiliateBookings.reduce<Record<string, { code: string; bookings: number; revenue: number }>>((acc, booking) => {
        const code = booking.promo_code_text ?? "Unknown";
        acc[code] = acc[code] ?? { code, bookings: 0, revenue: 0 };
        acc[code].bookings += 1;
        acc[code].revenue += booking.total_kes ?? 0;
        return acc;
      }, {}),
    ).sort((a, b) => b.revenue - a.revenue);

    const expenseByCategory = Object.values(
      expenses.reduce<Record<string, { category: string; total: number }>>((acc, expense) => {
        const category = expense.category;
        acc[category] = acc[category] ?? { category, total: 0 };
        acc[category].total += expense.amount_kes;
        return acc;
      }, {}),
    ).sort((a, b) => b.total - a.total);

    const revenueByMonthMap = confirmedBookings.reduce<Record<string, { month: string; revenue: number; expenses: number }>>((acc, booking) => {
      const key = monthKey(booking.check_in);
      acc[key] = acc[key] ?? { month: key, revenue: 0, expenses: 0 };
      acc[key].revenue += booking.total_kes ?? 0;
      return acc;
    }, {});

    for (const expense of expenses) {
      const key = monthKey(expense.expense_date);
      revenueByMonthMap[key] = revenueByMonthMap[key] ?? { month: key, revenue: 0, expenses: 0 };
      revenueByMonthMap[key].expenses += expense.amount_kes;
    }

    const monthlyPerformance = Object.values(revenueByMonthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map((entry) => ({
        ...entry,
        net: entry.revenue - entry.expenses,
      }));

    return {
      confirmedRevenue,
      pendingRevenue,
      affiliateRevenue,
      totalDiscounts,
      totalExpenses,
      netRevenue,
      expenseByArea,
      affiliateBreakdown,
      expenseByCategory,
      monthlyPerformance,
      recentExpenses: expenses.slice(0, 8),
      recentConfirmedBookings: confirmedBookings.slice(0, 8),
    };
  }, [bookingsQuery.data, expensesQuery.data]);

  return {
    bookingsQuery,
    expensesQuery,
    summary,
    isLoading: bookingsQuery.isLoading || expensesQuery.isLoading,
  };
};
