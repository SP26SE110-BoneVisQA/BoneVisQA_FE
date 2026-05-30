'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useLogout } from '@/lib/useLogout';
import { getStoredUserInfo } from '@/lib/getStoredUserInfo';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  LayoutDashboard,
  Users,
  FileText,
  BrainCircuit,
  Settings,
  LogOut,
  Stethoscope,
  Database,
  BadgeCheck,
  BookOpen,
  FileBarChart,
  Shield,
  Archive,
  ScrollText,
} from 'lucide-react';

export default function AdminSidebar() {
  const pathname = usePathname();
  const logout = useLogout();
  const { t } = useTranslation();

  const stored = getStoredUserInfo();
  const initials = stored.fullName
    ? stored.fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('')
    : 'AD';
  const displayName = stored.fullName || 'Admin';
  const displayEmail = stored.email || '';

  const adminMenuItems = [
    { icon: LayoutDashboard, label: t('nav.dashboard', 'Dashboard'), href: '/admin/dashboard' },
    { icon: Users, label: t('nav.users', 'Users'), href: '/admin/users' },
    {
      icon: BadgeCheck,
      label: t('nav.medicalVerifications', 'Medical Verifications'),
      href: '/admin/verifications',
    },
    { icon: BookOpen, label: t('nav.classes', 'Classes'), href: '/admin/classes' },
    { icon: Database, label: t('nav.documents', 'Documents'), href: '/admin/documents' },
    { icon: FileText, label: t('nav.cases', 'Cases'), href: '/admin/cases' },
    { icon: ScrollText, label: t('nav.logs', 'System Logs'), href: '/admin/logs' },
    { icon: Shield, label: t('nav.systemConfig', 'System Config'), href: '/admin/system-config' },
    { icon: FileBarChart, label: t('nav.reports', 'Reports'), href: '/admin/reports' },
    { icon: Archive, label: t('nav.backup', 'Backup/Export'), href: '/admin/backup' },
    { icon: BrainCircuit, label: t('nav.aiConfig', 'AI Config'), href: '/admin/ai-config' },
    { icon: Settings, label: t('nav.settings', 'Settings'), href: '/admin/settings' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar-bg text-sidebar-text flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
          <Stethoscope className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-semibold text-lg leading-tight">BoneVisQA</h1>
          <p className="text-xs opacity-70">Admin Panel</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="app-scroll-y flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {adminMenuItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200
                    ${isActive
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white'}`} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User profile */}
      {stored.fullName && (
        <div className="border-t border-white/10 px-3 py-4">
          <div className="mb-4 flex justify-center gap-2 border-b border-white/10 pb-4">
            <div className="overflow-hidden rounded-lg bg-white p-0.5 shadow-sm">
              <ThemeToggle />
            </div>
            <div className="overflow-hidden rounded-lg bg-white p-0.5 shadow-sm">
              <LanguageSwitcher />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-white/50">{displayEmail || 'Admin'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {t('nav.signOut', 'Sign Out')}
          </button>
        </div>
      )}
    </aside>
  );
}
