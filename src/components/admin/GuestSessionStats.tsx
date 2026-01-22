import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  RefreshCw,
  Loader2,
  Calendar,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, parseISO } from 'date-fns';

interface DailyCount {
  date: string;
  count: number;
}

interface HourlyCount {
  hour: number;
  count: number;
}

export default function GuestSessionStats() {
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [weekCount, setWeekCount] = useState<number>(0);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [hourlyCounts, setHourlyCounts] = useState<HourlyCount[]>([]);

  async function fetchStats() {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      const weekStart = startOfWeek(now, { weekStartsOn: 0 }).toISOString();
      const thirtyDaysAgo = subDays(now, 30).toISOString();

      // Fetch total count
      const { count: total, error: totalError } = await supabase
        .from('guest_sessions')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;
      setTotalCount(total || 0);

      // Fetch today's count
      const { count: today, error: todayError } = await supabase
        .from('guest_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      if (todayError) throw todayError;
      setTodayCount(today || 0);

      // Fetch this week's count
      const { count: week, error: weekError } = await supabase
        .from('guest_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekStart);

      if (weekError) throw weekError;
      setWeekCount(week || 0);

      // Fetch sessions from last 30 days for daily breakdown (paginate for accuracy)
      const sessions: Array<{ created_at: string }> = [];
      const PAGE_SIZE = 1000;
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error: sessionsError } = await supabase
          .from('guest_sessions')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (sessionsError) throw sessionsError;
        if (!data || data.length === 0) break;

        sessions.push(...data);
        if (data.length < PAGE_SIZE) break;
      }

      // Group by day
      const dailyMap = new Map<string, number>();
      const hourlyMap = new Map<number, number>();

      // Initialize last 30 days with 0
      for (let i = 0; i < 30; i++) {
        const date = format(subDays(now, i), 'yyyy-MM-dd');
        dailyMap.set(date, 0);
      }

      // Initialize hours with 0
      for (let h = 0; h < 24; h++) {
        hourlyMap.set(h, 0);
      }

      // Count sessions
      (sessions || []).forEach((session) => {
        const date = format(parseISO(session.created_at), 'yyyy-MM-dd');
        const hour = parseISO(session.created_at).getHours();

        if (dailyMap.has(date)) {
          dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
        }
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      });

      // Convert to arrays
      const dailyArray: DailyCount[] = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => b.date.localeCompare(a.date));

      const hourlyArray: HourlyCount[] = Array.from(hourlyMap.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour - b.hour);

      setDailyCounts(dailyArray);
      setHourlyCounts(hourlyArray);
    } catch (error) {
      console.error('Error fetching guest session stats:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  };

  const maxDailyCount = Math.max(...dailyCounts.map((d) => d.count), 1);
  const maxHourlyCount = Math.max(...hourlyCounts.map((h) => h.count), 1);

  // Find peak hour
  const peakHour = hourlyCounts.reduce(
    (max, curr) => (curr.count > max.count ? curr : max),
    { hour: 0, count: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Guest Session Analytics
            </CardTitle>
            <CardDescription>
              Track anonymous browsing sessions from guest users
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Total Sessions</span>
            </div>
            <p className="text-3xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalCount.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Today</span>
            </div>
            <p className="text-3xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : todayCount.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">This Week</span>
            </div>
            <p className="text-3xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : weekCount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Sessions by Day */}
        <div>
          <h3 className="text-sm font-medium mb-3">Sessions by Day (Last 30 Days)</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : dailyCounts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No data available</p>
            ) : (
              dailyCounts.slice(0, 14).map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-24 flex-shrink-0">
                    {format(parseISO(day.date), 'MMM d, EEE')}
                  </span>
                  <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${(day.count / maxDailyCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{day.count}</span>
                </div>
              ))
            )}
          </div>
          {dailyCounts.length > 14 && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing last 14 days. Total of {dailyCounts.length} days of data.
            </p>
          )}
        </div>

        {/* Peak Hours */}
        <div>
          <h3 className="text-sm font-medium mb-3">
            Peak Hours
            {peakHour.count > 0 && (
              <span className="text-muted-foreground font-normal ml-2">
                (Busiest: {formatHour(peakHour.hour)})
              </span>
            )}
          </h3>
          <div className="grid grid-cols-12 gap-1">
            {hourlyCounts.map((hourData) => (
              <div key={hourData.hour} className="flex flex-col items-center">
                <div
                  className="w-full bg-muted rounded-t relative"
                  style={{ height: '60px' }}
                >
                  <div
                    className="absolute bottom-0 w-full bg-primary/70 rounded-t transition-all duration-300"
                    style={{
                      height: `${(hourData.count / maxHourlyCount) * 100}%`,
                      minHeight: hourData.count > 0 ? '4px' : '0',
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {hourData.hour % 6 === 0 ? formatHour(hourData.hour) : ''}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
