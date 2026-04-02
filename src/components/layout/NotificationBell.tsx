import { Bell, CheckCircle, XCircle, AlertTriangle, Clock, ShieldAlert, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotificationsInApp, Notification } from "@/hooks/useNotificationsInApp";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const typeIcons: Record<string, typeof Bell> = {
  mission_approved: CheckCircle,
  mission_completed: Check,
  mission_rejected: XCircle,
  mission_expired: Clock,
  mission_blocked: ShieldAlert,
};

const typeColors: Record<string, string> = {
  mission_approved: "text-primary",
  mission_completed: "text-primary",
  mission_rejected: "text-destructive",
  mission_expired: "text-muted-foreground",
  mission_blocked: "text-accent",
};

export default function NotificationBell() {
  const { data: notifications = [], unreadCount, markAsRead, markAllRead } = useNotificationsInApp();
  const navigate = useNavigate();

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead.mutate(n.id);
    if (n.mission_id) navigate(`/mission/${n.mission_id}`);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.slice(0, 20).map((n) => {
              const Icon = typeIcons[n.type] || AlertTriangle;
              const color = typeColors[n.type] || "text-muted-foreground";
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0 ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? "font-semibold text-foreground" : "text-foreground"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
