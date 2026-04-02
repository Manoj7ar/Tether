import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from "recharts";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import { TrendingUp, ShieldCheck, AlertTriangle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(40, 75%, 30%)",
  active: "hsl(140, 25%, 50%)",
  completed: "hsl(150, 38%, 17%)",
  rejected: "hsl(0, 69%, 33%)",
  expired: "hsl(22, 6%, 40%)",
};

const RISK_COLORS: Record<string, string> = {
  low: "hsl(140, 25%, 50%)",
  medium: "hsl(40, 75%, 40%)",
  high: "hsl(0, 69%, 33%)",
};

export default function DashboardAnalytics() {
  const { data, isLoading } = useDashboardAnalytics();

  if (isLoading || !data) {
    return (
      <div className="card-tether p-8 text-center">
        <p className="text-sm text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Missions" value={data.totalMissions} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
        <StatCard label="Approval Rate" value={`${data.approvalRate}%`} icon={<ShieldCheck className="h-4 w-4 text-primary" />} />
        <StatCard label="Actions Allowed" value={data.actionsAllowed} icon={<ShieldCheck className="h-4 w-4 text-primary" />} />
        <StatCard label="Actions Blocked" value={data.actionsBlocked} icon={<AlertTriangle className="h-4 w-4 text-accent" />} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Mission Activity */}
        <div className="card-tether p-5 lg:col-span-2">
          <h3 className="text-sm font-medium text-foreground mb-4">Mission Activity (30 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.missionTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 15%, 18%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(30, 10%, 60%)" }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(30, 10%, 60%)" }} />
              <Tooltip contentStyle={{ background: "hsl(150, 20%, 10%)", border: "1px solid hsl(150, 15%, 18%)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="hsl(140, 25%, 50%)" fill="hsl(140, 25%, 50%)" fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown */}
        <div className="card-tether p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Status Breakdown</h3>
          {data.statusDistribution.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.statusDistribution}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.statusDistribution.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "hsl(22, 6%, 40%)"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(150, 20%, 10%)", border: "1px solid hsl(150, 15%, 18%)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {data.statusDistribution.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[s.name] || "hsl(22, 6%, 40%)" }} />
                {s.name} ({s.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="card-tether p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Risk Distribution</h3>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data.riskDistribution} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 15%, 18%)" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(30, 10%, 60%)" }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "hsl(30, 10%, 60%)" }} width={60} />
            <Tooltip contentStyle={{ background: "hsl(150, 20%, 10%)", border: "1px solid hsl(150, 15%, 18%)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.riskDistribution.map((entry) => (
                <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "hsl(22, 6%, 40%)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="card-tether p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
