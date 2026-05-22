'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import {
  fetchStudySession,
  submitFlashcardReview,
  fetchFlashcardDeck,
  fetchFlashcardsByDeck,
  toggleFlashcardBookmark,
  type FlashcardDeckDto,
  type FlashcardDto,
} from '@/lib/api/flashcards';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  Loader2,
  Brain,
  Eye,
  FlipHorizontal,
  Sparkles,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';

function FlashcardItem({
  card,
  isFlipped,
  onFlip,
  onRate,
  onBookmark,
  isBookmarking,
}: {
  card: FlashcardDto;
  isFlipped: boolean;
  onFlip: () => void;
  onRate: (quality: number) => void;
  onBookmark: () => void;
  isBookmarking: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-2xl">
        <button
          onClick={onFlip}
          className="relative h-[400px] w-full cursor-pointer perspective-1000"
        >
          <div
            className={`absolute inset-0 rounded-2xl border-2 border-border bg-card p-8 shadow-lg transition-all duration-500 ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front */}
            <div
              className="flex h-full flex-col items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Question</p>
              <p className="mt-4 text-center text-xl font-medium text-foreground">{card.frontContent}</p>
              <p className="mt-8 flex items-center gap-1 text-xs text-muted-foreground">
                <FlipHorizontal className="h-3 w-3" />
                Click to reveal answer
              </p>
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 flex h-full flex-col items-center justify-center rounded-2xl bg-primary/5 p-8"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Answer</p>
              <p className="mt-4 text-center text-xl font-medium text-foreground">{card.backContent}</p>
            </div>
          </div>
        </button>

        {/* Bookmark Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBookmark();
          }}
          disabled={isBookmarking}
          className={`absolute right-2 top-2 rounded-full p-2 transition-all ${
            card.isBookmarked
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          }`}
          title={card.isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks for later review'}
        >
          {isBookmarking ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : card.isBookmarked ? (
            <BookmarkCheck className="h-5 w-5" />
          ) : (
            <Bookmark className="h-5 w-5" />
          )}
        </button>
      </div>

      {isFlipped && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="text-sm font-medium text-muted-foreground">How well did you know this?</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
              onClick={() => onRate(0)}
            >
              <X className="h-4 w-4" />
              Again
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300"
              onClick={() => onRate(2)}
            >
              Hard
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300"
              onClick={() => onRate(3)}
            >
              Good
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
              onClick={() => onRate(5)}
            >
              <Check className="h-4 w-4" />
              Easy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RatingExplanation() {
  return (
    <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
      <p className="mb-2 font-semibold text-foreground">Rating Guide:</p>
      <ul className="space-y-1">
        <li><span className="font-medium text-red-600">Again</span> - Complete blank, need to see again</li>
        <li><span className="font-medium text-orange-600">Hard</span> - Remembered with difficulty</li>
        <li><span className="font-medium text-yellow-600">Good</span> - Remembered correctly</li>
        <li><span className="font-medium text-green-600">Easy</span> - Perfect, will show less often</li>
      </ul>
    </div>
  );
}

export default function StudyFlashcardsPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const deckId = params.id as string;

  const [deck, setDeck] = useState<FlashcardDeckDto | null>(null);
  const [cards, setCards] = useState<FlashcardDto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [deckData, cardsData] = await Promise.all([
        fetchFlashcardDeck(deckId),
        fetchFlashcardsByDeck(deckId),
      ]);
      setDeck(deckData);
      setCards(cardsData);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load flashcards');
      router.push('/student/flashcards');
    } finally {
      setLoading(false);
    }
  }, [deckId, toast, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentCard = cards[currentIndex];

  const handleFlip = (index: number) => {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleRate = async (quality: number) => {
    if (!currentCard) return;
    setSubmitting(true);
    try {
      await submitFlashcardReview(currentCard.id, quality);
      setReviewedCount((prev) => prev + 1);
      if (quality >= 4) {
        setMasteredCount((prev) => prev + 1);
      }

      if (currentIndex < cards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        toast.success('You have completed this deck!');
        router.push('/student/flashcards');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setFlippedCards(new Set());
  };

  const handleBookmark = async () => {
    if (!currentCard) return;
    setBookmarking(true);
    try {
      const updated = await toggleFlashcardBookmark(currentCard.id);
      setCards((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      toast.success(
        updated.isBookmarked
          ? 'Card added to bookmarks!'
          : 'Card removed from bookmarks'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update bookmark');
    } finally {
      setBookmarking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!deck || cards.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Brain className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">No cards to study</h2>
        <p className="text-muted-foreground">This deck has no flashcards yet.</p>
        <Link href="/student/flashcards">
          <Button variant="outline">Back to Flashcards</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/student/flashcards"
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <div className="h-6 w-px bg-border" />
              <div>
                <h1 className="text-lg font-semibold text-foreground">{deck.deckName}</h1>
                <p className="text-xs text-muted-foreground">
                  Card {currentIndex + 1} of {cards.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShuffle} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Shuffle
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <Brain className="h-3 w-3 text-[#006a68]" />
                {masteredCount}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3 text-muted-foreground" />
                {reviewedCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        {currentCard && (
          <FlashcardItem
            card={currentCard}
            isFlipped={flippedCards.has(currentIndex)}
            onFlip={() => handleFlip(currentIndex)}
            onRate={handleRate}
            onBookmark={handleBookmark}
            isBookmarking={bookmarking}
          />
        )}

        <RatingExplanation />

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((prev) => Math.min(cards.length - 1, prev + 1))}
            disabled={currentIndex === cards.length - 1}
            className="gap-1.5"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
