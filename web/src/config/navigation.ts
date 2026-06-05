import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CheckSquare,
  ClipboardList,
  Database,
  Eye,
  FileQuestion,
  Flag,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Megaphone,
  ScanSearch,
  Server,
  Stethoscope,
  Users,
  BarChart3,
} from 'lucide-react';

export type AppRoleKey = 'admin' | 'lecturer' | 'expert' | 'student';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const navByRole: Record<AppRoleKey, NavItem[]> = {
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'User Management', href: '/admin/users', icon: Users },
    { label: 'Medical Student Verification', href: '/admin/verifications', icon: GraduationCap },
    { label: 'Class Management', href: '/admin/classes', icon: GraduationCap },
    { label: 'Medical Cases', href: '/admin/cases', icon: BookOpen },
    { label: 'Classifications', href: '/admin/classifications', icon: Stethoscope },
    { label: 'Knowledge Base', href: '/admin/documents', icon: Database },
    { label: 'Flagged chunks', href: '/admin/flagged-chunks', icon: Flag },
    { label: 'System Configuration', href: '/admin/system-config', icon: Server },
  ],
  lecturer: [
    { label: 'Dashboard', href: '/lecturer/dashboard', icon: LayoutDashboard },
    { label: 'Triage Workbench', href: '/lecturer/qa-triage', icon: Stethoscope },
    { label: 'Classes', href: '/lecturer/classes', icon: Users },
    { label: 'Quiz Library', href: '/lecturer/quizzes', icon: FileQuestion },
    { label: 'Assignments', href: '/lecturer/assignments', icon: ClipboardList },
    { label: 'Cases', href: '/lecturer/cases', icon: BookOpen },
    { label: 'Analytics', href: '/lecturer/analytics', icon: BarChart3 },
    { label: 'Announcements', href: '/lecturer/announcements', icon: Megaphone },
  ],
  expert: [
    { label: 'Dashboard', href: '/expert/dashboard', icon: LayoutDashboard },
    { label: 'Expert review', href: '/expert/reviews', icon: CheckSquare },
    { label: 'Case Library', href: '/expert/cases', icon: BookOpen },
  ],
  student: [
    { label: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Case Library', href: '/student/catalog', icon: BookOpen },
    { label: 'Visual QA', href: '/student/visual-qa/workspace', icon: ScanSearch },
    { label: 'Quizzes', href: '/student/quizzes', icon: HelpCircle },
    { label: 'Flashcards', href: '/student/review', icon: Eye },
    { label: 'Analytics', href: '/student/analytics', icon: BarChart3 },
    { label: 'Class', href: '/student/classes', icon: Users },
  ],
};

export const roleMeta: Record<
  AppRoleKey,
  { label: string; actionHref: string; actionLabel: string }
> = {
  admin: { label: 'Radiology Education', actionHref: '/admin/documents', actionLabel: 'Upload Document' },
  lecturer: { label: 'Radiology Education', actionHref: '/lecturer/qa-triage', actionLabel: 'Open Triage' },
  expert: { label: 'Radiology Education', actionHref: '/expert/reviews', actionLabel: 'Open reviews' },
  student: { label: 'Radiology Education', actionHref: '/student/visual-qa/workspace', actionLabel: 'New Visual QA' },
};
