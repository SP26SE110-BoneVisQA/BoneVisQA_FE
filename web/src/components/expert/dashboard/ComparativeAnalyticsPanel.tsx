import React from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Activity } from 'lucide-react';
import type { ExpertComparativeAnalytics, MonthTrend } from '@/lib/api/expert-dashboard';

interface ComparativeAnalyticsPanelProps {
  analytics: ExpertComparativeAnalytics | null;
}

export default function ComparativeAnalyticsPanel({ analytics }: ComparativeAnalyticsPanelProps) {
  if (!analytics) {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold text-card-foreground mb-4">Comparative Analytics</h2>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-success" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'up') return 'text-success';
    if (trend === 'down') return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getTrendBg = (trend: string) => {
    if (trend === 'up') return 'bg-success/10';
    if (trend === 'down') return 'bg-destructive/10';
    return 'bg-muted/50';
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="text-lg font-semibold text-card-foreground mb-4">Comparative Analytics</h2>

      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">This Week vs Last Week</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-card-foreground">
                {analytics.weekOverWeek.currentPeriodReviews}
              </span>
              <span className="text-xs text-muted-foreground">reviews</span>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${getTrendBg(analytics.weekOverWeek.trend)}`}>
            <TrendIcon trend={analytics.weekOverWeek.trend} />
            <span className={`text-sm font-medium ${getTrendColor(analytics.weekOverWeek.trend)}`}>
              {analytics.weekOverWeek.percentageChange > 0 ? '+' : ''}
              {analytics.weekOverWeek.percentageChange}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">This Month vs Last Month</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-card-foreground">
                {analytics.monthOverMonth.currentPeriodReviews}
              </span>
              <span className="text-xs text-muted-foreground">reviews</span>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${getTrendBg(analytics.monthOverMonth.trend)}`}>
            <TrendIcon trend={analytics.monthOverMonth.trend} />
            <span className={`text-sm font-medium ${getTrendColor(analytics.monthOverMonth.trend)}`}>
              {analytics.monthOverMonth.percentageChange > 0 ? '+' : ''}
              {analytics.monthOverMonth.percentageChange}%
            </span>
          </div>
        </div>

        <MonthlyTrendChart trend={analytics.monthlyTrend} />
      </div>
    </div>
  );
}

function MonthlyTrendChart({ trend }: { trend: MonthTrend }) {
  const maxReviews = Math.max(1, ...trend.dataPoints.map((d) => d.reviews));

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  return (
    <div className="pt-3 border-t border-border/50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">6-Month Trend</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Avg: {trend.average.toFixed(1)}</span>
          <span className={`text-xs font-medium ${trend.growthRate >= 0 ? 'text-success' : 'text-destructive'}`}>
            {trend.growthRate >= 0 ? '+' : ''}{trend.growthRate}%
          </span>
        </div>
      </div>

      <div className="flex items-end gap-1.5 h-16">
        {trend.dataPoints.slice(-6).map((point, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-primary/20 hover:bg-primary/30 rounded-sm transition-colors relative group"
              style={{ height: `${Math.max(4, (point.reviews / maxReviews) * 48)}px` }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-background border border-border rounded px-1.5 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-sm">
                {point.reviews}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {formatMonth(point.month)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
