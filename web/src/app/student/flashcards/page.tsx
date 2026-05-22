'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchFlashcardDecks,
  createFlashcardDeck,
  deleteFlashcardDeck,
  fetchFlashcardStats,
  fetchBookmarkedCards,
  type FlashcardDeckDto,
  type FlashcardStatsDto,
  type FlashcardDto,
} from '@/lib/api/flashcards';
import {
  BookOpen,
  Plus,
  Loader2,
  Trash2,
  Play,
  MoreHorizontal,
  Layers,
  Brain,
  Clock,
  Flame,
  CreditCard,
  Edit3,
  X,
  Settings,
  Bookmark,
  BookmarkCheck,
  Upload,
  FileSpreadsheet,
} from 'lucide-react';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function DeckCard({
  deck,
  onDelete,
}: {
  deck: FlashcardDeckDto;
  onDelete: (deck: FlashcardDeckDto) => void;
}) {
  const progress = deck.totalCards > 0 ? Math.round((deck.masteredCards / deck.totalCards) * 100) : 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="truncate text-base font-semibold text-foreground">{deck.deckName}</h3>
            </div>
            {deck.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{deck.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {deck.sourceType && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                {deck.sourceType}
              </span>
            )}
            <Link
              href={`/student/flashcards/${deck.id}/manage`}
              className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
              title="Manage Cards"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              onClick={() => onDelete(deck)}
              className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <CreditCard className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
            <p className="mt-1 text-xs font-semibold">{deck.totalCards}</p>
            <p className="text-[10px] text-muted-foreground">Cards</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <Brain className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
            <p className="mt-1 text-xs font-semibold">{deck.masteredCards}</p>
            <p className="text-[10px] text-muted-foreground">Mastered</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <Clock className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
            <p className="mt-1 text-xs font-semibold">
              {deck.lastStudiedAt ? '1' : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">Studied</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border px-5 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Created {formatDate(deck.createdAt)}</p>
          <Link
            href={`/student/flashcards/${deck.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <Play className="h-3 w-3" />
            Study
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatsCards({ stats }: { stats: FlashcardStatsDto }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <Layers className="mx-auto h-5 w-5 text-primary" />
        <p className="mt-2 text-2xl font-black text-foreground">{stats.totalDecks}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Decks</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <CreditCard className="mx-auto h-5 w-5 text-primary" />
        <p className="mt-2 text-2xl font-black text-foreground">{stats.totalCards}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cards</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <Brain className="mx-auto h-5 w-5 text-[#006a68]" />
        <p className="mt-2 text-2xl font-black text-[#006a68]">{stats.masteredCards}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mastered</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <Clock className="mx-auto h-5 w-5 text-[#924e00]" />
        <p className="mt-2 text-2xl font-black text-[#924e00]">{stats.dueToday}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due Today</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <Flame className="mx-auto h-5 w-5 text-[#ba1a1a]" />
        <p className="mt-2 text-2xl font-black text-[#ba1a1a]">{stats.streak}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Streak</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <BookOpen className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-2xl font-black text-foreground">{stats.cardsStudied}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Studied</p>
      </div>
    </div>
  );
}

function CreateDeckDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (deck: FlashcardDeckDto) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const deck = await createFlashcardDeck(name.trim(), description.trim() || undefined);
      onCreated(deck);
      setName('');
      setDescription('');
      onClose();
      toast.success('Deck created successfully!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create deck');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Create New Deck</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Deck Name</label>
            <Input
              placeholder="e.g., Bone Fractures Review"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Description (optional)</label>
            <textarea
              placeholder="What is this deck about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Deck'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({
  deck,
  onClose,
  onDeleted,
}: {
  deck: FlashcardDeckDto | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleDelete = async () => {
    if (!deck) return;
    setLoading(true);
    try {
      await deleteFlashcardDeck(deck.id);
      onDeleted();
      onClose();
      toast.success('Deck deleted successfully!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete deck');
    } finally {
      setLoading(false);
    }
  };

  if (!deck) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Delete Deck?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to delete <strong>{deck.deckName}</strong>? This will also delete all{' '}
          {deck.totalCards} flashcards in this deck. This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function StudentFlashcardsPage() {
  const toast = useToast();
  const router = useRouter();
  const [decks, setDecks] = useState<FlashcardDeckDto[]>([]);
  const [stats, setStats] = useState<FlashcardStatsDto | null>(null);
  const [bookmarkedCards, setBookmarkedCards] = useState<FlashcardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<FlashcardDeckDto | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [decksData, statsData, bookmarkedData] = await Promise.all([
        fetchFlashcardDecks(),
        fetchFlashcardStats(),
        fetchBookmarkedCards(),
      ]);
      setDecks(decksData);
      setStats(statsData);
      setBookmarkedCards(bookmarkedData.bookmarkedCards);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load flashcards');
      setDecks([]);
      setStats(null);
      setBookmarkedCards([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDeckCreated = (deck: FlashcardDeckDto) => {
    setDecks((prev) => [deck, ...prev]);
  };

  const handleDeckDeleted = () => {
    if (deckToDelete) {
      setDecks((prev) => prev.filter((d) => d.id !== deckToDelete.id));
      setDeckToDelete(null);
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Flashcards"
        subtitle="Create and study flashcards to reinforce your learning from cases, documents, or any text."
      />
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        {stats && <StatsCards stats={stats} />}

        {/* Bookmarked Cards Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <BookmarkCheck className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Bookmarked for Review</h2>
                <p className="text-sm text-muted-foreground">
                  {bookmarkedCards.length > 0
                    ? `${bookmarkedCards.length} card${bookmarkedCards.length > 1 ? 's' : ''} saved`
                    : 'No cards bookmarked yet'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/student/flashcards/bookmarked')}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <Play className="mr-2 h-4 w-4" />
              {bookmarkedCards.length > 0 ? 'Study Bookmarked' : 'View'}
            </Button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Your Decks</h2>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Deck
          </Button>
        </div>

        {loading ? (
          <div className="mt-8 flex min-h-[200px] items-center justify-center rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Loading your flashcards…
            </div>
          </div>
        ) : decks.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No flashcards yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Create your first deck to start learning, or generate flashcards from a case study or
              document.
            </p>
            <Button className="mt-6" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Deck
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <DeckCard key={deck.id} deck={deck} onDelete={setDeckToDelete} />
            ))}
          </div>
        )}
      </div>

      <CreateDeckDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleDeckCreated}
      />

      <DeleteConfirmDialog
        deck={deckToDelete}
        onClose={() => setDeckToDelete(null)}
        onDeleted={handleDeckDeleted}
      />
    </div>
  );
}
