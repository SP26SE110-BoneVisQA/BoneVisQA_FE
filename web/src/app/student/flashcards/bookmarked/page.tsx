'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchBookmarkedCards,
  toggleFlashcardBookmark,
  type FlashcardDto,
} from '@/lib/api/flashcards';
import {
  ArrowLeft,
  Search,
  Loader2,
  BookmarkCheck,
  Bookmark,
  FlipHorizontal,
} from 'lucide-react';

function BookmarkCard({
  card,
  onBookmark,
  isBookmarking,
}: {
  card: FlashcardDto;
  onBookmark: () => void;
  isBookmarking: boolean;
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="group relative">
      <div
        className="relative h-[280px] cursor-pointer rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:shadow-md"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 flex flex-col rounded-xl p-4 transition-all duration-300 ${
            isFlipped ? 'invisible opacity-0' : 'visible opacity-100'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Question
            </span>
            {card.sourceType && (
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                {card.sourceType}
              </span>
            )}
          </div>
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-base font-medium text-foreground line-clamp-6">
              {card.frontContent}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <FlipHorizontal className="h-3 w-3" />
            Click to flip
          </div>
        </div>

        {/* Back */}
        <div
          className={`absolute inset-0 flex flex-col rounded-xl bg-primary/5 p-4 transition-all duration-300 ${
            isFlipped ? 'visible opacity-100' : 'invisible opacity-0'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              Answer
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-base font-medium text-foreground line-clamp-6">
              {card.backContent}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1 text-xs text-primary">
            <FlipHorizontal className="h-3 w-3" />
            Click to flip back
          </div>
        </div>
      </div>

      {/* Bookmark Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBookmark();
        }}
        disabled={isBookmarking}
        className={`absolute right-2 top-2 rounded-full p-2 shadow-sm transition-all ${
          card.isBookmarked
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        title={card.isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
      >
        {isBookmarking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : card.isBookmarked ? (
          <BookmarkCheck className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function EmptyState({ hasCards }: { hasCards: boolean }) {
  if (hasCards) return null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="rounded-full bg-muted p-6">
        <BookmarkCheck className="h-16 w-16 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">No bookmarked cards</h2>
      <p className="max-w-md text-center text-muted-foreground">
        Bookmark cards while studying to add them here for quick access and review.
      </p>
      <Link href="/student/flashcards">
        <Button variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Flashcards
        </Button>
      </Link>
    </div>
  );
}

export default function BookmarkedStudyPage() {
  const router = useRouter();
  const toast = useToast();

  const [cards, setCards] = useState<FlashcardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarkingCardId, setBookmarkingCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBookmarkedCards();
      console.log('Bookmarked cards API response:', data);
      setCards(data.bookmarkedCards);
    } catch (e) {
      console.error('Failed to load bookmarked cards:', e);
      toast.error(e instanceof Error ? e.message : 'Failed to load bookmarked cards');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleBookmark = async (card: FlashcardDto) => {
    setBookmarkingCardId(card.id);
    try {
      const updated = await toggleFlashcardBookmark(card.id);
      if (!updated.isBookmarked) {
        setCards((prev) => prev.filter((c) => c.id !== card.id));
        toast.success('Card removed from bookmarks');
      } else {
        setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update bookmark');
    } finally {
      setBookmarkingCardId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredCards = cards.filter(
    (card) =>
      card.frontContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.backContent.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/student/flashcards"
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <BookmarkCheck className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold text-foreground">Bookmarked for Review</h1>
              </div>
            </div>

            {cards.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 pl-9"
                  />
                </div>
                <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                  {filteredCards.length} {filteredCards.length === 1 ? 'card' : 'cards'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <EmptyState hasCards={cards.length > 0} />

        {cards.length > 0 && filteredCards.length === 0 && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
            <Search className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">No cards match your search</h2>
            <p className="text-muted-foreground">Try a different search term.</p>
            <Button variant="outline" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          </div>
        )}

        {filteredCards.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCards.map((card) => (
              <BookmarkCard
                key={card.id}
                card={card}
                onBookmark={() => handleBookmark(card)}
                isBookmarking={bookmarkingCardId === card.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
