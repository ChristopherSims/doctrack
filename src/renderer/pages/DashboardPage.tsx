import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
  ListChecks,
  AlertCircle,
  Activity,
  Tag,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as API from '../../api/api';

interface DashboardStats {
  totalDocuments: number;
  totalRequirements: number;
  requirementsByStatus: Record<string, number>;
  requirementsByPriority: Record<string, number>;
  documentsNeedingAttention: Array<{
    id: string;
    title: string;
    draftCount: number;
    reviewCount: number;
  }>;
  recentActivity: Array<{
    id: string;
    timestamp: string;
    action: string;
    actorName: string;
    resourceType: string;
    resourceId: string;
  }>;
  topTags: Array<{ tag: string; count: number }>;
}

interface DashboardPageProps {
  onSelectDocument: (id: string, title: string) => void;
  onNavigate: (page: 'documents' | 'audit') => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-400',
  review: 'bg-yellow-500',
  approved: 'bg-green-500',
  implemented: 'bg-blue-500',
  verified: 'bg-black dark:bg-white',
  unknown: 'bg-gray-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
  unknown: 'bg-gray-300',
};

const KPICard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
  colorClass?: string;
}> = ({ title, value, icon, subtitle, colorClass }) => (
  <Card className="relative overflow-hidden">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${colorClass || 'bg-primary/10 text-primary'}`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const MiniBarChart: React.FC<{
  data: Record<string, number>;
  colorMap: Record<string, string>;
  title: string;
}> = ({ data, colorMap, title }) => {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-2">
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground">No data</p>
          )}
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 text-xs capitalize text-muted-foreground truncate">{key}</span>
              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${colorMap[key] || colorMap['unknown'] || 'bg-gray-400'} transition-all duration-500`}
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-xs font-medium text-right">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ActivityItem: React.FC<{
  activity: DashboardStats['recentActivity'][0];
}> = ({ activity }) => {
  const time = new Date(activity.timestamp).toLocaleString();
  const actionLabel = activity.action.replace(/_/g, ' ');
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <div className="mt-0.5">
        <Activity className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{activity.actorName || 'system'}</span>{' '}
          <span className="text-muted-foreground">{actionLabel}</span>{' '}
          <span className="font-medium truncate">{activity.resourceType}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{time}</p>
      </div>
    </div>
  );
};

const DashboardPage: React.FC<DashboardPageProps> = ({ onSelectDocument, onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const result = await API.getDashboard();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const pendingReviews = stats?.requirementsByStatus?.review || 0;
  const draftCount = stats?.requirementsByStatus?.draft || 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Failed to load dashboard</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={loadDashboard}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onNavigate('documents')}>
            <FileText className="h-4 w-4 mr-1" />
            Documents
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('audit')}>
            <Activity className="h-4 w-4 mr-1" />
            Audit Log
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Documents"
          value={stats.totalDocuments}
          icon={<FileText className="h-5 w-5" />}
          subtitle="Total tracked documents"
          colorClass="bg-blue-500/10 text-blue-600"
        />
        <KPICard
          title="Requirements"
          value={stats.totalRequirements}
          icon={<ListChecks className="h-5 w-5" />}
          subtitle="Across all documents"
          colorClass="bg-emerald-500/10 text-emerald-600"
        />
        <KPICard
          title="Pending Review"
          value={pendingReviews}
          icon={<AlertCircle className="h-5 w-5" />}
          subtitle="Requirements awaiting approval"
          colorClass="bg-yellow-500/10 text-yellow-600"
        />
        <KPICard
          title="Drafts"
          value={draftCount}
          icon={<FileText className="h-5 w-5" />}
          subtitle="Unfinished requirements"
          colorClass="bg-slate-500/10 text-slate-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <MiniBarChart
          title="Requirements by Status"
          data={stats.requirementsByStatus}
          colorMap={STATUS_COLORS}
        />
        <MiniBarChart
          title="Requirements by Priority"
          data={stats.requirementsByPriority}
          colorMap={PRIORITY_COLORS}
        />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Documents Needing Attention */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              Needing Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {stats.documentsNeedingAttention.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">All caught up!</p>
            ) : (
              <div className="flex flex-col gap-2">
                {stats.documentsNeedingAttention.map((doc) => (
                  <button
                    key={doc.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-accent transition-colors"
                    onClick={() => onSelectDocument(doc.id, doc.title)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <div className="flex gap-2 mt-0.5">
                        {doc.reviewCount > 0 && (
                          <Badge variant="outline" className="text-xs h-5">
                            {doc.reviewCount} in review
                          </Badge>
                        )}
                        {doc.draftCount > 0 && (
                          <Badge variant="secondary" className="text-xs h-5">
                            {doc.draftCount} draft
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 max-h-[320px] overflow-auto">
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
            ) : (
              <div className="flex flex-col">
                {stats.recentActivity.map((a) => (
                  <ActivityItem key={a.id} activity={a} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Tags */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Top Tags
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {stats.topTags.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No tags yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.topTags.map((t) => (
                  <Badge key={t.tag} variant="secondary" className="text-xs">
                    {t.tag}
                    <span className="ml-1 text-muted-foreground">({t.count})</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
