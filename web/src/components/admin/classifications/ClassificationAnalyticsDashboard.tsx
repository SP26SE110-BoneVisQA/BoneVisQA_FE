'use client';

import { useQuery } from '@tanstack/react-query';
import { Bone, Stethoscope, BookOpen, FileQuestion, StethoscopeIcon, TrendingUp, Users } from 'lucide-react';
import { http } from '@/lib/api/client';

interface SpecialtyStats {
  specialtyId: string;
  specialtyName: string;
  specialtyCode: string;
  level: number;
  totalClasses: number;
  totalQuizzes: number;
  totalMedicalCases: number;
  totalExperts: number;
}

interface ClassificationAnalytics {
  totalBoneSpecialties: number;
  totalPathologyCategories: number;
  totalClasses: number;
  totalQuizzes: number;
  totalMedicalCases: number;
  specialtyStats: SpecialtyStats[];
  expertsBySpecialty: {
    specialtyId: string;
    specialtyName: string;
    totalExperts: number;
    primaryExperts: number;
    averageProficiencyLevel: number;
  }[];
}

async function fetchClassificationAnalytics(): Promise<ClassificationAnalytics> {
  const { data } = await http.get<ClassificationAnalytics>('/api/admin/classification-analytics');
  return data;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

interface SpecialtyRowProps {
  stats: SpecialtyStats;
}

function SpecialtyRow({ stats }: SpecialtyRowProps) {
  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10`}>
            <Bone className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className={`font-semibold ${stats.level === 0 ? 'text-primary' : 'text-foreground'}`}>
              {stats.specialtyName}
            </span>
            <span className="ml-2 text-xs text-muted-foreground font-mono">({stats.specialtyCode})</span>
            {stats.level > 0 && (
              <span className="ml-2 text-xs bg-secondary/20 px-2 py-0.5 rounded-full">
                Lv.{stats.level}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-sm font-semibold">
          <BookOpen className="w-3 h-3" />
          {stats.totalClasses}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-lg text-sm font-semibold">
          <FileQuestion className="w-3 h-3" />
          {stats.totalQuizzes}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-sm font-semibold">
          <StethoscopeIcon className="w-3 h-3" />
          {stats.totalMedicalCases}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-sm font-semibold">
          <Users className="w-3 h-3" />
          {stats.totalExperts}
        </span>
      </td>
    </tr>
  );
}

export default function ClassificationAnalyticsDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'classification-analytics'],
    queryFn: fetchClassificationAnalytics,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Bone className="w-8 h-8 animate-pulse text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-destructive">
        Failed to load analytics data
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Bone Specialties"
          value={data.totalBoneSpecialties}
          icon={<Bone className="w-6 h-6 text-primary" />}
          color="bg-primary/10"
        />
        <StatCard
          title="Pathology Categories"
          value={data.totalPathologyCategories}
          icon={<Stethoscope className="w-6 h-6 text-secondary" />}
          color="bg-secondary/10"
        />
        <StatCard
          title="Total Classes"
          value={data.totalClasses}
          icon={<BookOpen className="w-6 h-6 text-blue-600" />}
          color="bg-blue-100"
        />
        <StatCard
          title="Total Quizzes"
          value={data.totalQuizzes}
          icon={<FileQuestion className="w-6 h-6 text-green-600" />}
          color="bg-green-100"
        />
        <StatCard
          title="Total Medical Cases"
          value={data.totalMedicalCases}
          icon={<StethoscopeIcon className="w-6 h-6 text-purple-600" />}
          color="bg-purple-100"
        />
      </div>

      {/* Specialty Stats Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Specialty Statistics</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Distribution by Bone Specialty
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">Specialty</th>
                <th className="px-4 py-3 font-bold text-center">Classes</th>
                <th className="px-4 py-3 font-bold text-center">Quizzes</th>
                <th className="px-4 py-3 font-bold text-center">Cases</th>
                <th className="px-4 py-3 font-bold text-center">Experts</th>
              </tr>
            </thead>
            <tbody>
              {data.specialtyStats && data.specialtyStats.length > 0 ? (
                data.specialtyStats.map((stats) => (
                  <SpecialtyRow key={stats.specialtyId} stats={stats} />
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No specialty data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
