import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useAdminCounts } from "@/hooks/useAdminCounts";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDays, Home, Image as ImageIcon, Inbox, LayoutDashboard, LogOut, Package, ReceiptText, Tag, Type } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Calendar; badgeKey?: "pendingBookings" | "newMessages" };

const items: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/bookings", label: "Bookings", icon: Calendar, badgeKey: "pendingBookings" },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/admin/expenses", label: "Expenses", icon: ReceiptText },
  { to: "/admin/messages", label: "Messages", icon: Inbox, badgeKey: "newMessages" },
  { to: "/admin/pods", label: "Pods", icon: Home },
  { to: "/admin/addons", label: "Add-ons", icon: Package },
  { to: "/admin/codes", label: "Codes", icon: Tag },
  { to: "/admin/content", label: "Site text", icon: Type },
  { to: "/admin/gallery", label: "Pod gallery", icon: ImageIcon },
];

const navCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full",
    isActive ? "bg-sage-deep/10 text-sage-deep font-medium" : "text-foreground/70 hover:bg-muted/60"
  );

const AdminSidebar = () => {
  const { data: counts } = useAdminCounts();
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-5 border-b border-border/60">
          <p className="font-display text-lg text-sage-deep leading-none">Wild by LERA</p>
          <p className="text-xs text-muted-foreground mt-1">Admin</p>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => {
                const count = it.badgeKey ? counts?.[it.badgeKey] ?? 0 : 0;
                return (
                  <SidebarMenuItem key={it.to}>
                    <SidebarMenuButton asChild>
                      <NavLink to={it.to} className={navCls}>
                        <it.icon size={16} />
                        <span className="flex-1">{it.label}</span>
                        {count > 0 && (
                          <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-medium rounded-full bg-ember text-bone">
                            {count}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export const AdminLayout = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [user, authLoading, navigate]);

  if (authLoading || roleLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen container py-20 max-w-2xl">
        <h1 className="font-display text-4xl text-sage-deep mb-4">Not authorized</h1>
        <p className="text-foreground/75 mb-2">Your account ({user.email}) doesn't have admin access yet.</p>
        <p className="text-sm text-muted-foreground mb-4">Run this in Lovable Cloud's SQL editor:</p>
        <pre className="bg-linen p-4 text-xs overflow-auto">{`INSERT INTO public.user_roles (user_id, role) VALUES ('${user.id}', 'admin');`}</pre>
        <Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}>
          <LogOut size={16} className="mr-2" /> Sign out
        </Button>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/60 px-4 bg-bone/60 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
              <LogOut size={14} className="mr-2" /> Sign out
            </Button>
          </header>
          <main className="flex-1 p-6 md:p-10 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
