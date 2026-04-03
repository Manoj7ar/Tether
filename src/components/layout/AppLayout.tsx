import { Link, useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/layout/NavLink";
import TetherLogo from "@/components/layout/TetherLogo";
import { getAccountDisplayLabel, getAccountInitials, useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Home, Plus, List, LinkIcon, Shield, Settings } from "lucide-react";
import { ReactNode } from "react";
import NotificationBell from "@/components/layout/NotificationBell";
import { useUserSettings } from "@/hooks/useUserSettings";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "New Mission", url: "/mission/new", icon: Plus },
  { title: "Mission Ledger", url: "/ledger", icon: List },
  { title: "Connected Accounts", url: "/accounts", icon: LinkIcon },
  { title: "Policy Engine", url: "/policy", icon: Shield },
  { title: "Settings", url: "/settings", icon: Settings },
];

function AppSidebarContent() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      <SidebarContent className="flex flex-col h-full">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <TetherLogo size={collapsed ? "sm" : "md"} showText={!collapsed} />
          </Link>
        </div>

        {/* Nav */}
        <SidebarGroup className="flex-1 py-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User */}
        {!collapsed && <UserSection />}
      </SidebarContent>
    </Sidebar>
  );
}

function UserSection() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const displayLine = getAccountDisplayLabel(user);
  const initials = getAccountInitials(user);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate" title={displayLine}>
            {displayLine}
          </p>
          <button onClick={handleSignOut} className="text-xs text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}


function DemoModeBanner() {
  const { data: settings } = useUserSettings();
  if (!settings?.demo_mode) return null;
  return (
    <div
      role="status"
      className="shrink-0 border-b border-accent/40 bg-accent/10 px-4 py-2 text-center text-xs font-medium text-foreground"
    >
      Demo mode — AI outputs and provider tool calls are simulated. OAuth sign-in and account linking stay real.
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebarContent />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b border-border px-4 bg-card">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="flex items-center gap-3">
              <NotificationBell />
            </div>
          </header>
          <DemoModeBanner />
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
