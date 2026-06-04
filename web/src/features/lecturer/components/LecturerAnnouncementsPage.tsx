'use client';

import { Suspense, useState, useEffect } from 'react';
import { QueryPageSkeleton } from '@/components/shared/QueryPageSkeleton';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ListPageLayout } from '@/components/layouts';
import { LecturerAnnouncementRow } from '@/components/lecturer/LecturerAnnouncementRow';
import { useLecturerAnnouncementsFeed, useCreateLecturerAnnouncement } from '@/features/lecturer/queries/use-lecturer-announcements';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { getClassAssignments, getLecturerClasses } from '@/lib/api/lecturer';
import { getStoredUserId } from '@/lib/getStoredUserId';
import { Bell, Plus, Send, Loader2, Link, X } from 'lucide-react';
import type { ClassAssignment } from '@/lib/api/types';

function LecturerAnnouncementsContent() {
  const feedQuery = useLecturerAnnouncementsFeed();
  const createMutation = useCreateLecturerAnnouncement();
  const searchParams = useSearchParams();
  const classIdFromUrl = searchParams.get('classId');
  const openNewFromUrl = searchParams.get('new') === '1';

  const [classes, setClasses] = useState<Awaited<ReturnType<typeof getLecturerClasses>>>([]);
  const announcements = feedQuery.data ?? [];
  const loading = feedQuery.isPending;

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Assignment selection
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const classAssignmentsQuery = useQuery({
    queryKey: ['lecturer', 'class-assignments', selectedClassId] as const,
    queryFn: () => getClassAssignments(selectedClassId),
    enabled: Boolean(selectedClassId),
  });
  const classAssignments = classAssignmentsQuery.data ?? [];
  const loadingAssignments = classAssignmentsQuery.isPending;

  // Filter
  const [filterClass, setFilterClass] = useState('all');

  useEffect(() => {
    const userId = getStoredUserId();
    if (!userId) return;
    void getLecturerClasses(userId).then(setClasses).catch(() => {});
  }, []);

  // Deep link from class detail: ?classId=...&new=1
  useEffect(() => {
    if (loading || classes.length === 0 || !classIdFromUrl) return;
    const exists = classes.some((c) => c.id === classIdFromUrl);
    if (!exists) return;
    setFilterClass(classIdFromUrl);
    setSelectedClassId(classIdFromUrl);
    if (openNewFromUrl) setShowCreate(true);
  }, [loading, classes, classIdFromUrl, openNewFromUrl]);

  useEffect(() => {
    if (!selectedClassId) return;
    setSelectedCaseId('');
    setSelectedQuizId('');
  }, [selectedClassId]);

  const handleSend = async () => {
    if (!newTitle.trim() || !newContent.trim() || !selectedClassId) {
      setCreateError('Please fill in all fields and select a class.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await createMutation.mutateAsync({
        classId: selectedClassId,
        body: {
          title: newTitle.trim(),
          content: newContent.trim(),
          sendEmail,
          assignmentId: selectedCaseId || selectedQuizId || null,
        },
      });
      appToast.success('Announcement sent successfully.');
      setShowCreate(false);
      setNewTitle('');
      setNewContent('');
      setSendEmail(true);
      setSelectedCaseId('');
      setSelectedQuizId('');
      // Keep class selected when filtering one class (e.g. from class page)
      if (filterClass === 'all') {
        setSelectedClassId('');
      } else {
        setSelectedClassId(filterClass);
      }
    } catch {
      setCreateError('Failed to send announcement. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const filtered =
    filterClass === 'all'
      ? announcements
      : announcements.filter((a) => a.classId === filterClass);

  const subtitle =
    filterClass === 'all'
      ? `${filtered.length} total`
      : `${filtered.length} in this class · ${announcements.length} total`;

  const errorMessage = feedQuery.error
    ? getQueryErrorMessage(feedQuery.error, 'Failed to load announcements.')
    : null;

  return (
    <ListPageLayout
      title="Announcements"
      isLoading={loading && announcements.length === 0}
      error={errorMessage}
      maxWidthClass="max-w-4xl"
    >
      <div>
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterClass('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                filterClass === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-card border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              All
            </button>
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilterClass(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  filterClass === c.id
                    ? 'bg-primary text-white'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {c.className}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors cursor-pointer text-sm font-medium shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Announcement
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h3 className="font-semibold text-card-foreground mb-4">New Announcement</h3>

            {createError && (
              <div className="mb-4 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {createError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1.5">
                  Target Class
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedCaseId('');
                    setSelectedQuizId('');
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                >
                  <option value="">Select a class...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} — {c.semester}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignment Selection - Combined dropdown for Case and Quiz */}
              {selectedClassId && (
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5" />
                      Related Assignment (Optional)
                    </div>
                  </label>
                  {loadingAssignments ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-input text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading assignments...
                    </div>
                  ) : classAssignments.length === 0 ? (
                    <div className="px-3 py-2.5 rounded-lg border border-border bg-input text-sm text-muted-foreground">
                      No assignments assigned to this class yet.
                    </div>
                  ) : (
                    <select
                      value={selectedCaseId || selectedQuizId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCaseId('');
                        setSelectedQuizId('');
                        if (val) {
                          const selected = classAssignments.find((a) => a.id === val);
                          if (selected?.type.toLowerCase() === 'case') {
                            setSelectedCaseId(val);
                          } else {
                            setSelectedQuizId(val);
                          }
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                    >
                      <option value="">None - General announcement</option>
                      {classAssignments.map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.type.toUpperCase()}] {a.title}
                          {a.dueDate && ` — Due: ${new Date(a.dueDate).toLocaleDateString()}`}
                          {a.isMandatory && ' ★'}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Link this announcement to a case or quiz to help students identify related work.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Announcement title..."
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1.5">
                  Content
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Write your announcement..."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">Send email notification</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Students enrolled in this class will receive an email with the announcement.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSendEmail(!sendEmail)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                    sendEmail ? 'bg-success' : 'bg-muted-foreground/30'
                  }`}
                >
                  <div
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      sendEmail ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleSend}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {creating ? 'Sending...' : 'Send Now'}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateError('');
                  setNewTitle('');
                  setNewContent('');
                  setSendEmail(true);
                  setSelectedCaseId('');
                  setSelectedQuizId('');
                  if (filterClass === 'all') setSelectedClassId('');
                  else setSelectedClassId(filterClass);
                }}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-card-foreground hover:bg-input cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <Loader2 className="w-8 h-8 text-primary mx-auto mb-3 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading announcements...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-card-foreground mb-1">No announcements</h3>
            <p className="text-sm text-muted-foreground">
              {announcements.length === 0
                ? 'Create an announcement to notify your students.'
                : 'No announcements for this class.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => (
              <LecturerAnnouncementRow
                key={a.id}
                announcement={a}
                showClassName={filterClass === 'all'}
                onUpdated={() => void feedQuery.refetch()}
                onDeleted={() => void feedQuery.refetch()}
                onError={(msg) => appToast.error(msg)}
              />
            ))}
          </div>
        )}
      </div>
    </ListPageLayout>
  );
}

function AnnouncementsFallback() {
  return <QueryPageSkeleton variant="list" minHeight="min-h-[400px]" />;
}

export function LecturerAnnouncementsPage() {
  return (
    <Suspense fallback={<AnnouncementsFallback />}>
      <LecturerAnnouncementsContent />
    </Suspense>
  );
}
