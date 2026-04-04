import { useTrustScore } from "@/hooks/useTrustScore";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { Shield } from "lucide-react";

export default function TrustScoreCard() {
  const { data, isLoading } = useTrustScore();

  if (isLoading || !data) return null;

  const { score, total_allowed, total_blocked, history } = data;

  const color =
    score >= 70 ? "hsl(var(--primary))" :
    score >= 40 ? "hsl(var(--accent))" :
    "hsl(var(--destructive))";

  const ringPercent = (score / 100) * 283; // circumference of r=45 circle

  return (
    <div className="card-tether p-5 animate-card-in">
      <div className="flex items-start gap-4">
        {/* Circular Gauge */}
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="6"
            />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeDasharray={`${ringPercent} 283`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold font-mono text-foreground">{score}</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Agent Trust Score</h3>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground mb-2">
            <span className="text-primary">{total_allowed} allowed</span>
            <span className="text-destructive">{total_blocked} blocked</span>
          </div>

          {/* Sparkline */}
          {history.length > 1 && (
            <div className="h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={color}
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    formatter={(val: number) => [`${val}`, "Score"]}
                    labelFormatter={(label: string) => label}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
