'use client';

import { useState } from 'react';
import { StudentAppChrome } from '@/components/student/StudentAppChrome';
import { AIQuizContent } from '@/components/student/AIQuizContent';
import { TopicChatContent } from '@/components/student/TopicChatContent';
import { Sparkles, Bot, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'quiz' | 'topic';

export default function AIAssistantPage() {
  const [activeTab, setActiveTab] = useState<TabType>('quiz');

  const tabs = [
    {
      id: 'quiz' as const,
      label: 'AI Quiz',
      icon: Sparkles,
      description: 'Tạo quiz trắc nghiệm với AI',
      gradient: 'from-violet-600 to-purple-600',
      activeGradient: 'bg-gradient-to-r from-violet-600 to-purple-600',
    },
    {
      id: 'topic' as const,
      label: 'AI Topic',
      icon: Bot,
      description: 'Chat với AI về chủ đề y khoa',
      gradient: 'from-teal-600 to-emerald-600',
      activeGradient: 'bg-gradient-to-r from-teal-600 to-emerald-600',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <StudentAppChrome
        breadcrumb="AI Assistant"
        title="AI Assistant"
        subtitle="Trợ lý AI cho việc học tập"
      />

      <main className="flex flex-1 flex-col px-3 py-4 sm:px-4 sm:py-6 max-w-4xl mx-auto w-full">
        {/* Tab Navigation */}
        <div className="mb-4 shrink-0">
          <div className="flex gap-1.5 rounded-xl border border-border bg-card p-1 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-all',
                    isActive
                      ? `${tab.activeGradient} text-white shadow-sm`
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex flex-1 flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden min-h-0">
          {activeTab === 'quiz' && (
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              <AIQuizContent embedded />
            </div>
          )}
          {activeTab === 'topic' && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <TopicChatContent embedded />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
