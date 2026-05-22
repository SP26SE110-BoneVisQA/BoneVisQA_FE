'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLogout } from '@/lib/useLogout';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  LayoutDashboard,
  BookOpen,
  BotMessageSquare,
  ClipboardList,
  Trophy,
  UserCircle,
  Settings,
  LogOut,
  Stethoscope,
  Sparkles,
  Eye,
  BrainCircuit,
  BarChart3,
} from 'lucide-react';

const studentMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/student/dashboard' },
  { icon: BookOpen, label: 'Case Catalog', href: '/student/catalog' },
  { icon: ClipboardList, label: 'History', href: '/student/history' },
  { icon: BotMessageSquare, label: 'AI Q&A', href: '/student/qa' },
  { icon: BrainCircuit, label: 'Spaced Review', href: '/student/review' },
  { icon: Trophy, label: 'Quizzes', href: '/student/quizzes' },
  { icon: Eye, label: 'My Flashcards', href: '/student/flashcards' },
  // TODO: Uncomment when AI Quiz is ready for production
  // { icon: Sparkles, label: 'AI Quiz', href: '/student/ai-quiz' },
  { icon: BarChart3, label: 'Analytics', href: '/student/analytics' },
  { icon: UserCircle, label: 'Profile', href: '/student/profile' },
  { icon: Settings, label: 'Settings', href: '/student/settings' },
];

export default function StudentSidebar() {
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar-bg text-sidebar-text flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
          <Stethoscope className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-semibold text-lg leading-tight">BoneVisQA</h1>
          <p className="text-xs opacity-70">Student Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {studentMenuItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/student/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer
                    transition-colors duration-150
                    ${
                      isActive
                        ? 'bg-sidebar-active text-sidebar-bg font-medium'
                        : 'hover:bg-sidebar-hover'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User & Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="bg-white rounded-lg p-0.5 shadow-sm overflow-hidden">
            <ThemeToggle />
          </div>
        </div>
        <Link
          href="/student/settings"
          className="flex items-center gap-3 px-4 py-3 mb-2 rounded-lg hover:bg-sidebar-hover transition-colors duration-150"
        >
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
            ST
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Student Name</p>
            <p className="text-xs opacity-70 truncate">student@bonevisqa.com</p>
          </div>
        </Link>
        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-sidebar-hover cursor-pointer transition-colors duration-150">
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
