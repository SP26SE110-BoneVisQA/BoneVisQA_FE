'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { quizExtensionsApi, type ReviewItem, type SpacedRepetitionStats } from '@/lib/api/quiz-extensions';
import { 
  fetchFlashcardRecommendations, 
  fetchFlashcardDecks, 
  createFlashcardDeck, 
  deleteFlashcardDeck, 
  fetchFlashcardsByDeck, 
  createFlashcard, 
  deleteFlashcard, 
  type FlashcardDeckDto, 
  type FlashcardDto 
} from '@/lib/api/student';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  BookOpen,
  Sparkles,
  ArrowLeft,
  BrainCircuit,
  Target,
  AlertTriangle,
  BookMarked,
  Loader2,
  Plus,
  Trash2,
  FlipHorizontal,
  Trophy,
  Clock,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Layers,
  Eye,
  Grid3X3,
  BookText,
  Shuffle,
  RotateCcw,
  Maximize2,
  Search,
  Filter,
  X,
  SortAsc,
  ChevronDown,
} from 'lucide-react';

export default function FlashcardReviewPage() {
  const [dueReviews, setDueReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<SpacedRepetitionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentReview, setCurrentReview] = useState<ReviewItem | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const [recommendations, setRecommendations] = useState<{
    success: boolean;
    masteryScore: number;
    studyTips?: string;
    suggestedTopics: string[];
    weakAreas: string[];
  } | null>(null);

  const [decks, setDecks] = useState<FlashcardDeckDto[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDescription, setNewDeckDescription] = useState('');
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<FlashcardDeckDto | null>(null);
  const [deletingDeck, setDeletingDeck] = useState(false);

  const [showCreateCard, setShowCreateCard] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');
  const [creatingCard, setCreatingCard] = useState(false);

  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeckDto | null>(null);
  const [deckCards, setDeckCards] = useState<FlashcardDto[]>([]);
  const [loadingDeckCards, setLoadingDeckCards] = useState(false);

  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [singleCardFlipped, setSingleCardFlipped] = useState(false);
  const [expandedCard, setExpandedCard] = useState<FlashcardDto | null>(null);
  const [expandedCardFlipped, setExpandedCardFlipped] = useState(false);

  // Search & Filter states for decks
  const [deckSearchQuery, setDeckSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'cards'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Card search state in deck detail
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [cardCurrentPage, setCardCurrentPage] = useState(1);

  // Category definitions
  const categories = [
    { value: 'all', label: 'Tất cả', icon: Layers },
    { value: 'quiz', label: 'Bài Quiz', icon: BookOpen },
    { value: 'ai', label: 'AI Tạo', icon: Sparkles },
    { value: 'manual', label: 'Tự tạo', icon: Plus },
  ];

  const sortOptions = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
    { value: 'name', label: 'A - Z' },
    { value: 'cards', label: 'Nhiều thẻ nhất' },
  ];

  // Constants
  const ITEMS_PER_PAGE = 6;
  const CARDS_PER_PAGE = 9;

  // Filter and sort decks
  const filteredDecks = decks
    .filter((deck) => {
      // Search filter
      const matchesSearch = deck.deckName.toLowerCase().includes(deckSearchQuery.toLowerCase());
      // Category filter (based on deck name patterns)
      if (selectedCategory === 'all') return matchesSearch;
      if (selectedCategory === 'quiz') return matchesSearch && (deck.deckName.includes('Quiz') || deck.deckName.includes('quiz'));
      if (selectedCategory === 'ai') return matchesSearch && (deck.deckName.includes('AI'));
      if (selectedCategory === 'manual') return matchesSearch && !(deck.deckName.includes('Quiz') || deck.deckName.includes('quiz') || deck.deckName.includes('AI'));
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return 0; // Keep original order (by creation date desc)
      if (sortBy === 'oldest') return 0;
      if (sortBy === 'name') return a.deckName.localeCompare(b.deckName);
      if (sortBy === 'cards') return (b.cardCount || 0) - (a.cardCount || 0);
      return 0;
    });

  // Pagination for decks
  const totalPages = Math.ceil(filteredDecks.length / ITEMS_PER_PAGE);
  const paginatedDecks = filteredDecks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [deckSearchQuery, selectedCategory, sortBy]);

  useEffect(() => {
    fetchData();
    fetchRecommendations();
    fetchDecks();
  }, []);

  const fetchData = async () => {
    try {
      const [reviews, statsData] = await Promise.all([
        quizExtensionsApi.getDueReviews(20),
        quizExtensionsApi.getSpacedRepetitionStats(),
      ]);
      setDueReviews(reviews);
      setStats(statsData);
      if (reviews.length > 0 && !currentReview) {
        setCurrentReview(reviews[0]);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const data = await fetchFlashcardRecommendations();
      setRecommendations(data);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const fetchDecks = async () => {
    setLoadingDecks(true);
    try {
      const data = await fetchFlashcardDecks();
      setDecks(data);
    } catch (error) {
      console.error('Error fetching decks:', error);
    } finally {
      setLoadingDecks(false);
    }
  };

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) return;
    setCreatingDeck(true);
    try {
      const deck = await createFlashcardDeck(newDeckName.trim(), newDeckDescription.trim() || undefined);
      setDecks([...decks, deck]);
      setShowCreateDeck(false);
      setNewDeckName('');
      setNewDeckDescription('');
    } catch (error) {
      console.error('Error creating deck:', error);
    } finally {
      setCreatingDeck(false);
    }
  };

  const handleDeleteDeck = async () => {
    if (!deckToDelete) return;
    setDeletingDeck(true);
    try {
      await deleteFlashcardDeck(deckToDelete.id);
      setDecks(decks.filter(d => d.id !== deckToDelete.id));
      setDeckToDelete(null);
    } catch (error) {
      console.error('Error deleting deck:', error);
    } finally {
      setDeletingDeck(false);
    }
  };

  const handleViewDeck = async (deck: FlashcardDeckDto) => {
    setSelectedDeck(deck);
    setLoadingDeckCards(true);
    setCurrentCardIndex(0);
    setSingleCardFlipped(false);
    setCardSearchQuery('');
    setCardCurrentPage(1);
    try {
      const cards = await fetchFlashcardsByDeck(deck.id);
      setDeckCards(cards);
    } catch (error) {
      console.error('Error fetching deck cards:', error);
    } finally {
      setLoadingDeckCards(false);
    }
  };

  const handleCreateCard = async () => {
    if (!newCardFront.trim() || !newCardBack.trim() || !selectedDeckId) return;
    setCreatingCard(true);
    try {
      const card = await createFlashcard(selectedDeckId, newCardFront.trim(), newCardBack.trim());
      setDeckCards([...deckCards, card]);
      setDecks(decks.map(d => d.id === selectedDeckId ? { ...d, cardCount: d.cardCount + 1 } : d));
      if (selectedDeck?.id === selectedDeckId) {
        setSelectedDeck({ ...selectedDeck, cardCount: selectedDeck.cardCount + 1 });
      }
      setNewCardFront('');
      setNewCardBack('');
      setShowCreateCard(false);
    } catch (error) {
      console.error('Error creating card:', error);
    } finally {
      setCreatingCard(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      await deleteFlashcard(cardId);
      setDeckCards(deckCards.filter(c => c.id !== cardId));
      if (selectedDeck) {
        setDecks(decks.map(d => d.id === selectedDeck.id ? { ...d, cardCount: d.cardCount - 1 } : d));
        setSelectedDeck({ ...selectedDeck, cardCount: selectedDeck.cardCount - 1 });
      }
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const handleReview = async (quality: number) => {
    if (!currentReview || processing) return;
    setProcessing(true);
    try {
      await quizExtensionsApi.submitReview(currentReview.scheduleId, quality);
      const remaining = dueReviews.filter(r => r.scheduleId !== currentReview.scheduleId);
      setDueReviews(remaining);
      setCurrentReview(remaining.length > 0 ? remaining[0] : null);
      setShowAnswer(false);
      setIsFlipped(false);
      const newStats = await quizExtensionsApi.getSpacedRepetitionStats();
      setStats(newStats);
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = () => {
    if (!currentReview) return;
    const remaining = dueReviews.filter(r => r.scheduleId !== currentReview.scheduleId);
    setDueReviews(remaining);
    setCurrentReview(remaining.length > 0 ? remaining[0] : null);
    setShowAnswer(false);
    setIsFlipped(false);
  };

  const handleFlip = () => {
    if (!showAnswer) setShowAnswer(true);
    setIsFlipped(!isFlipped);
  };

  const nextCard = () => {
    if (currentCardIndex < deckCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setSingleCardFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setSingleCardFlipped(false);
    }
  };

  const shuffleCards = () => {
    const shuffled = [...deckCards].sort(() => Math.random() - 0.5);
    setDeckCards(shuffled);
    setCurrentCardIndex(0);
    setSingleCardFlipped(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Flashcard Review" subtitle="Spaced repetition for better retention" />
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-24 bg-slate-200 rounded-2xl" />
            <div className="h-80 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // ========== DECK DETAIL ==========
  if (selectedDeck) {
    // Filter cards based on search
    const filteredCards = deckCards.filter(card =>
      card.frontContent.toLowerCase().includes(cardSearchQuery.toLowerCase()) ||
      card.backContent.toLowerCase().includes(cardSearchQuery.toLowerCase())
    );

    // Pagination for cards
    const totalCardPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);
    const paginatedCards = filteredCards.slice(
      (cardCurrentPage - 1) * CARDS_PER_PAGE,
      cardCurrentPage * CARDS_PER_PAGE
    );

    // Reset card page when search changes
    useEffect(() => {
      setCardCurrentPage(1);
    }, [cardSearchQuery]);

    // Single card view uses full filtered list
    const currentCardIndexInFiltered = deckCards.findIndex(c => c.id === paginatedCards[0]?.id);
    const currentCard = viewMode === 'single' && paginatedCards.length > 0
      ? paginatedCards[cardCurrentPage - 1] || paginatedCards[0]
      : paginatedCards[0];
    const progress = filteredCards.length > 0
      ? ((filteredCards.findIndex(c => c.id === currentCard?.id) + 1) / filteredCards.length) * 100
      : 0;

    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => setSelectedDeck(null)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại
                </Button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Layers className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <h1 className="font-bold text-lg text-slate-900">{selectedDeck.deckName}</h1>
                    <p className="text-sm text-slate-500">
                      {cardSearchQuery
                        ? `${filteredCards.length} / ${deckCards.length} thẻ`
                        : `${deckCards.length} thẻ`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {/* Card Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm thẻ..."
                    value={cardSearchQuery}
                    onChange={(e) => setCardSearchQuery(e.target.value)}
                    className="pl-9 pr-8 py-2 w-48 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  {cardSearchQuery && (
                    <button
                      onClick={() => setCardSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
                    >
                      <X className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  )}
                </div>
                <Dialog open={showCreateCard} onOpenChange={setShowCreateCard}>
                  <DialogTrigger asChild>
                    <Button variant="outline" onClick={() => setSelectedDeckId(selectedDeck.id)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Thêm thẻ
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Thêm Flashcard Mới</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Mặt trước (Câu hỏi)</label>
                        <Textarea value={newCardFront} onChange={(e) => setNewCardFront(e.target.value)} placeholder="Nhập câu hỏi..." rows={3} />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Mặt sau (Đáp án)</label>
                        <Textarea value={newCardBack} onChange={(e) => setNewCardBack(e.target.value)} placeholder="Nhập đáp án..." rows={3} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowCreateCard(false)}>Hủy</Button>
                        <Button onClick={handleCreateCard} disabled={!newCardFront.trim() || !newCardBack.trim() || creatingCard}>
                          {creatingCard ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                          Thêm thẻ
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* View Mode Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2",
                  viewMode === 'grid' 
                    ? "bg-white shadow-sm text-slate-900" 
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Grid3X3 className="h-4 w-4" />
                Lưới
              </button>
              <button
                onClick={() => { setViewMode('single'); setCurrentCardIndex(0); setSingleCardFlipped(false); }}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2",
                  viewMode === 'single' 
                    ? "bg-white shadow-sm text-slate-900" 
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <BookText className="h-4 w-4" />
                Lật thẻ
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          {loadingDeckCards ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : deckCards.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-slate-200">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Layers className="h-10 w-10 text-slate-400" />
              </div>
              <p className="text-lg text-slate-600 mb-6">Chưa có thẻ nào trong bộ này</p>
              <Button onClick={() => setShowCreateCard(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Thêm thẻ đầu tiên
              </Button>
            </div>
          ) : viewMode === 'single' ? (
            // ========== SINGLE CARD VIEW ==========
            <div className="space-y-6">
              {/* Progress Info */}
              <div className="flex items-center justify-between px-2">
                <span className="text-sm font-medium text-slate-600">
                  {filteredCards.length > 0 ? filteredCards.findIndex(c => c.id === currentCard?.id) + 1 : 0}/{filteredCards.length}
                  {cardSearchQuery && <span className="text-slate-400"> (tìm thấy)</span>}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={shuffleCards}
                    className="gap-1.5 text-slate-500 hover:text-slate-700 h-8 px-2"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    <span className="text-xs">Xáo trộn</span>
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mx-2">
                <div 
                  className="h-full bg-slate-800 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Single Card - Flip Container */}
              <div 
                className="relative mx-auto cursor-pointer"
                style={{ maxWidth: '700px', minHeight: '450px' }}
                onClick={() => setSingleCardFlipped(!singleCardFlipped)}
              >
                {/* Front */}
                <div 
                  className={cn(
                    "absolute inset-0 rounded-2xl bg-white shadow-xl border border-slate-200 p-8 flex flex-col transition-all duration-500",
                    singleCardFlipped ? "opacity-0 -translate-x-4 rotate-3" : "opacity-100 translate-x-0 rotate-0"
                  )}
                >
                  <span className="inline-block px-4 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold w-fit mb-4">
                    CÂU HỎI
                  </span>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-2xl font-medium text-slate-800 text-center leading-relaxed">
                      {currentCard?.frontContent}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-slate-400 mt-4">
                    <FlipHorizontal className="h-5 w-5" />
                    <span className="text-base">Nhấn để lật thẻ</span>
                  </div>
                </div>

                {/* Back */}
                <div 
                  className={cn(
                    "absolute inset-0 rounded-2xl bg-slate-800 shadow-xl p-8 flex flex-col text-white transition-all duration-500",
                    singleCardFlipped ? "opacity-100 translate-x-0 rotate-0" : "opacity-0 translate-x-4 -rotate-3"
                  )}
                >
                  <span className="inline-block px-4 py-1.5 rounded-lg bg-white/10 text-white/90 text-sm font-bold w-fit mb-4">
                    ĐÁP ÁN
                  </span>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-2xl font-medium text-center leading-relaxed">
                      {currentCard?.backContent}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-white/60 mt-4">
                    <RotateCcw className="h-5 w-5" />
                    <span className="text-base">Nhấn để lật lại</span>
                  </div>
                </div>
              </div>

              {/* Navigation Dots */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setCardCurrentPage(p => Math.max(1, p - 1))}
                  disabled={cardCurrentPage === 1 || filteredCards.length === 0}
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-all border",
                    cardCurrentPage === 1
                      ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                      : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="px-3 text-sm text-slate-600 font-medium">
                  {cardCurrentPage} / {Math.max(1, totalCardPages)}
                </span>

                <button
                  onClick={() => setCardCurrentPage(p => Math.min(totalCardPages, p + 1))}
                  disabled={cardCurrentPage >= totalCardPages || filteredCards.length === 0}
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-all border",
                    cardCurrentPage >= totalCardPages
                      ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                      : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            // ========== GRID VIEW ==========
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedCards.map((card) => (
                  <FlipCard key={card.id} card={card} index={deckCards.findIndex(c => c.id === card.id)} onDelete={() => handleDeleteCard(card.id)} onExpand={() => setExpandedCard(card)} />
                ))}
              </div>

              {/* Card Pagination */}
              {totalCardPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    onClick={() => setCardCurrentPage(p => Math.max(1, p - 1))}
                    disabled={cardCurrentPage === 1}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                      cardCurrentPage === 1
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    )}
                  >
                    <ChevronLeft className="h-4 w-4 inline mr-1" />
                    Trước
                  </button>

                  <div className="flex gap-1">
                    {Array.from({ length: totalCardPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCardCurrentPage(page)}
                        className={cn(
                          "w-9 h-9 rounded-lg text-sm font-medium transition-all",
                          page === cardCurrentPage
                            ? "bg-slate-800 text-white"
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        )}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCardCurrentPage(p => Math.min(totalCardPages, p + 1))}
                    disabled={cardCurrentPage >= totalCardPages}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                      cardCurrentPage >= totalCardPages
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    )}
                  >
                    Sau
                    <ChevronRight className="h-4 w-4 inline ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Expanded Card Modal - Pop-out Effect */}
          {expandedCard && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              {/* Backdrop Overlay */}
              <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => { setExpandedCard(null); setExpandedCardFlipped(false); }}
              />
              
              {/* Pop-out Card */}
              <div className="relative w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
                {/* Card */}
                <div className="flex-1 rounded-3xl shadow-2xl overflow-hidden bg-white">
                  
                  {/* FRONT SIDE - Question */}
                  <div 
                    className={cn(
                      "absolute inset-0 sm:relative bg-white rounded-3xl flex flex-col transition-all duration-500",
                      expandedCardFlipped ? "translate-x-full opacity-0 sm:translate-x-full sm:opacity-0 sm:pointer-events-none" : "translate-x-0 opacity-100 sm:translate-x-0 sm:opacity-100"
                    )}
                    onClick={() => setExpandedCardFlipped(true)}
                  >
                    {/* Header - Fixed */}
                    <div className="flex items-center justify-between p-6 sm:p-8 border-b border-slate-100 bg-white rounded-t-3xl">
                      <div className="flex items-center gap-4">
                        <span className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-lg font-bold">CÂU HỎI</span>
                        <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold">
                          #{deckCards.findIndex(c => c.id === expandedCard.id) + 1}
                        </span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setExpandedCard(null); setExpandedCardFlipped(false); }}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6 sm:p-8 min-h-[200px] max-h-[50vh]">
                      <p className="text-xl sm:text-2xl font-medium text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                        {expandedCard.frontContent}
                      </p>
                    </div>
                    
                    {/* Footer - Fixed */}
                    <div className="p-6 sm:p-8 border-t border-slate-100 bg-white rounded-b-3xl">
                      <div className="flex items-center justify-center gap-3 text-slate-400 cursor-pointer hover:text-primary transition-colors">
                        <FlipHorizontal className="h-5 w-5" />
                        <span className="text-lg">Nhấn để xem đáp án</span>
                      </div>
                    </div>
                  </div>

                  {/* BACK SIDE - Answer */}
                  <div 
                    className={cn(
                      "absolute inset-0 sm:relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl flex flex-col text-white transition-all duration-500",
                      expandedCardFlipped ? "translate-x-0 opacity-100 sm:translate-x-0 sm:opacity-100" : "-translate-x-full opacity-0 sm:-translate-x-full sm:opacity-0 sm:pointer-events-none"
                    )}
                    onClick={() => setExpandedCardFlipped(false)}
                  >
                    {/* Header - Fixed */}
                    <div className="flex items-center justify-between p-6 sm:p-8 border-b border-white/10">
                      <div className="flex items-center gap-4">
                        <span className="px-4 py-2 rounded-xl bg-white/10 text-white/90 text-lg font-bold">ĐÁP ÁN</span>
                        <span className="px-3 py-1 rounded-lg bg-white/10 text-white/70 text-sm font-semibold">
                          #{deckCards.findIndex(c => c.id === expandedCard.id) + 1}
                        </span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setExpandedCard(null); setExpandedCardFlipped(false); }}
                        className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6 sm:p-8 min-h-[200px] max-h-[50vh]">
                      <p className="text-xl sm:text-2xl font-medium leading-relaxed whitespace-pre-wrap break-words">
                        {expandedCard.backContent}
                      </p>
                    </div>
                    
                    {/* Footer - Fixed */}
                    <div className="p-6 sm:p-8 border-t border-white/10">
                      <div className="flex items-center justify-center gap-3 text-white/50 cursor-pointer hover:text-white transition-colors">
                        <RotateCcw className="h-5 w-5" />
                        <span className="text-lg">Nhấn để xem lại câu hỏi</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    onClick={() => { setExpandedCard(null); setExpandedCardFlipped(false); }}
                    className="px-6 py-3 rounded-xl bg-white text-slate-700 font-semibold hover:bg-slate-100 transition-colors shadow-lg flex items-center gap-2"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Đóng
                  </button>
                  <button
                    onClick={() => { handleDeleteCard(expandedCard.id); setExpandedCard(null); setExpandedCardFlipped(false); }}
                    className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors shadow-lg flex items-center gap-2"
                  >
                    <Trash2 className="h-5 w-5" />
                    Xóa thẻ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== MAIN VIEW ==========
  if (!currentReview) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="Flashcard Review" subtitle="Spaced repetition for better retention" />
        
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Quá hạn" value={stats.overdue ?? 0} color="red" />
              <StatCard icon={<Clock className="h-5 w-5" />} label="Hôm nay" value={stats.dueToday ?? 0} color="amber" />
              <StatCard icon={<BookOpen className="h-5 w-5" />} label="Ngày mai" value={stats.dueTomorrow ?? 0} color="blue" />
              <StatCard icon={<Trophy className="h-5 w-5" />} label="Đã thuộc" value={stats.mastered ?? 0} color="emerald" />
            </div>
          )}

          {/* Mastery Score */}
          {recommendations?.success && recommendations.masteryScore > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Điểm Thành Thạo AI</h3>
                    <p className="text-sm text-slate-500">Dựa trên lịch sử học tập</p>
                  </div>
                </div>
                <span className={cn("text-3xl font-bold", recommendations.masteryScore >= 60 ? "text-emerald-600" : "text-amber-600")}>
                  {recommendations.masteryScore}%
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", recommendations.masteryScore >= 60 ? "bg-emerald-500" : "bg-amber-500")}
                  style={{ width: `${recommendations.masteryScore}%` }}
                />
              </div>
            </div>
          )}

          {/* Decks List */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Header with Search & Filter */}
            <div className="p-6 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <BookMarked className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Bộ Flashcard Của Tôi</h2>
                    <p className="text-sm text-slate-500">
                      {deckSearchQuery || selectedCategory !== 'all'
                        ? `${filteredDecks.length} / ${decks.length} bộ`
                        : `${decks.length} bộ`}
                    </p>
                  </div>
                </div>

                <Dialog open={showCreateDeck} onOpenChange={setShowCreateDeck}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Tạo Bộ Mới
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tạo Bộ Flashcard Mới</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Tên bộ thẻ</label>
                        <Input value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} placeholder="VD: Gãy xương" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Mô tả (tùy chọn)</label>
                        <Textarea value={newDeckDescription} onChange={(e) => setNewDeckDescription(e.target.value)} placeholder="Mô tả ngắn..." rows={2} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowCreateDeck(false)}>Hủy</Button>
                        <Button onClick={handleCreateDeck} disabled={!newDeckName.trim() || creatingDeck}>
                          {creatingDeck ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                          Tạo Bộ
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Search & Filter Row */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm bộ flashcard..."
                    value={deckSearchQuery}
                    onChange={(e) => setDeckSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                  />
                  {deckSearchQuery && (
                    <button
                      onClick={() => setDeckSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full"
                    >
                      <X className="h-4 w-4 text-slate-400" />
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <div className="relative">
                  <button
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                      selectedCategory !== 'all'
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <Filter className="h-4 w-4" />
                    {categories.find(c => c.value === selectedCategory)?.label || 'Tất cả'}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showCategoryDropdown && "rotate-180")} />
                  </button>

                  {showCategoryDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-10 overflow-hidden">
                      {categories.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.value}
                            onClick={() => {
                              setSelectedCategory(cat.value);
                              setShowCategoryDropdown(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
                              selectedCategory === cat.value
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:border-slate-300 transition-all"
                  >
                    <SortAsc className="h-4 w-4" />
                    {sortOptions.find(s => s.value === sortBy)?.label}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showSortDropdown && "rotate-180")} />
                  </button>

                  {showSortDropdown && (
                    <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-xl border border-slate-200 shadow-lg z-10 overflow-hidden">
                      {sortOptions.map((sort) => (
                        <button
                          key={sort.value}
                          onClick={() => {
                            setSortBy(sort.value as typeof sortBy);
                            setShowSortDropdown(false);
                          }}
                          className={cn(
                            "w-full px-4 py-2.5 text-sm text-left transition-colors",
                            sortBy === sort.value
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {sort.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deckToDelete} onOpenChange={(open) => !open && setDeckToDelete(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Xóa Bộ Flashcard</DialogTitle>
                  <DialogDescription asChild>
                    <div className="space-y-2">
                      <p>Bạn có chắc chắn muốn xóa bộ flashcard này?</p>
                      <div className="rounded-lg bg-slate-100 p-3">
                        <p className="font-semibold text-slate-900">{deckToDelete?.deckName}</p>
                        <p className="text-sm text-slate-500">{deckToDelete?.cardCount} thẻ</p>
                      </div>
                      <p className="text-sm text-red-600 font-medium">Hành động này không thể hoàn tác.</p>
                    </div>
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDeckToDelete(null)} disabled={deletingDeck}>
                    Hủy
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteDeck} disabled={deletingDeck}>
                    {deletingDeck ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Xóa
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="p-6">
              {loadingDecks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : decks.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Layers className="h-10 w-10 text-slate-400" />
                  </div>
                  <p className="text-lg text-slate-600 mb-6">Chưa có bộ flashcard nào</p>
                  <Button onClick={() => setShowCreateDeck(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Tạo Bộ Đầu Tiên
                  </Button>
                </div>
              ) : filteredDecks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Search className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-lg text-slate-600 mb-2">Không tìm thấy bộ flashcard</p>
                  <p className="text-sm text-slate-500 mb-4">Thử từ khóa khác hoặc xóa bộ lọc</p>
                  <Button variant="outline" onClick={() => { setDeckSearchQuery(''); setSelectedCategory('all'); }} className="gap-2">
                    <X className="h-4 w-4" />
                    Xóa bộ lọc
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedDecks.map((deck) => (
                    <div
                      key={deck.id}
                      className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
                      onClick={() => handleViewDeck(deck)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                          <BookMarked className="h-6 w-6 text-slate-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{deck.deckName}</h3>
                          <p className="text-sm text-slate-500">{deck.cardCount} thẻ</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Visible Delete Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setDeckToDelete(deck); }}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Xóa
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Deck Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-6">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1",
                          currentPage === 1
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        )}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Trước
                      </button>

                      <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={cn(
                              "w-10 h-10 rounded-lg text-sm font-medium transition-all",
                              page === currentPage
                                ? "bg-slate-800 text-white shadow-md"
                                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                            )}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1",
                          currentPage >= totalPages
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        )}
                      >
                        Sau
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Empty State */}
          <div className="bg-white rounded-2xl p-16 text-center border border-slate-200">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Tuyệt vời!</h2>
            <p className="text-slate-600 mb-8">Bạn đã hoàn thành hết các thẻ ôn tập trong ngày.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="gap-2">
                <Link href="/student/quizzes?tab=practice"><Target className="h-5 w-5 mr-2" />Làm Quiz</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/student/dashboard">Dashboard</Link>
              </Button>
            </div>
          </div>

          {/* AI Tips */}
          {recommendations?.success && recommendations.studyTips && (
            <div className="bg-slate-100 rounded-2xl p-6 border border-slate-200">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <BrainCircuit className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Gợi Ý Từ AI</h3>
                  <p className="text-slate-600 leading-relaxed">{recommendations.studyTips}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== REVIEW MODE ==========
  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Flashcard Review" subtitle="Spaced repetition for better retention" />
      
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Progress */}
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">Tiến độ ôn tập</span>
            <span className="text-sm text-slate-500">{dueReviews.length} thẻ còn lại</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-slate-800 rounded-full transition-all" 
              style={{ width: `${((20 - dueReviews.length) / 20) * 100}%` }} 
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild className="text-slate-600 hover:text-slate-900 hover:bg-slate-100">
            <Link href="/student/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Link>
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="gap-2 text-slate-500 hover:text-slate-700">
            Bỏ qua <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Case Info */}
        <div className="flex items-center gap-3 text-sm text-slate-600 bg-white rounded-xl px-4 py-3 border border-slate-200">
          <BookOpen className="h-4 w-4" />
          <span>{currentReview.caseTitle}</span>
          <span className="ml-auto flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full text-xs text-slate-500">
            <RotateCcw className="h-3 w-3" /> {currentReview.repetitionCount}x
          </span>
        </div>

        {/* Flashcard - Clean Design */}
        <div className="perspective-1000 mx-auto" style={{ maxWidth: '600px' }}>
          <div 
            className={cn(
              "relative w-full h-96 cursor-pointer transition-transform-3d",
              isFlipped ? "rotate-y-180" : ""
            )}
            onClick={handleFlip}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Front */}
            <div 
              className="absolute inset-0 rounded-2xl bg-white shadow-lg border border-slate-200 flex flex-col items-center justify-center p-12"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="absolute top-6 left-6 px-4 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold">
                CÂU HỎI
              </div>
              <p className="text-2xl font-medium text-slate-800 text-center leading-relaxed">
                {currentReview.questionText}
              </p>
              <div className="absolute bottom-6 flex items-center gap-2 text-slate-400">
                <FlipHorizontal className="h-5 w-5" />
                <span className="text-base">Nhấn để xem đáp án</span>
              </div>
            </div>

            {/* Back */}
            <div 
              className="absolute inset-0 rounded-2xl bg-slate-800 shadow-lg flex flex-col items-center justify-center p-12 text-white"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <div className="absolute top-6 left-6 px-4 py-1.5 rounded-lg bg-white/10 text-white/90 text-sm font-bold">
                ĐÁP ÁN
              </div>
              <p className="text-2xl font-medium text-center leading-relaxed">
                {currentReview.correctAnswer}
              </p>
              <div className="absolute bottom-6 flex items-center gap-2 text-white/60">
                <RotateCcw className="h-5 w-5" />
                <span className="text-base">Nhấn để lật lại</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rating */}
        {!showAnswer ? (
          <Button 
            onClick={() => setShowAnswer(true)} 
            className="w-full h-14 text-lg font-medium"
          >
            <Eye className="h-5 w-5 mr-2" />Xem Đáp Án
          </Button>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-sm font-medium text-slate-600">Bạn trả lời như thế nào?</p>
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => handleReview(0)} 
                disabled={processing}
                className="h-auto py-4 flex-col gap-2 rounded-xl border-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-all"
              >
                <XCircle className="h-6 w-6" />
                <span className="font-semibold">Lại</span>
                <span className="text-xs text-red-400">Không nhớ</span>
              </button>
              <button 
                onClick={() => handleReview(3)} 
                disabled={processing}
                className="h-auto py-4 flex-col gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:border-amber-300 transition-all"
              >
                <TrendingUp className="h-6 w-6" />
                <span className="font-semibold">Khó</span>
                <span className="text-xs text-amber-400">Nhớ lúc được</span>
              </button>
              <button 
                onClick={() => handleReview(4)} 
                disabled={processing}
                className="h-auto py-4 flex-col gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
              >
                <CheckCircle className="h-6 w-6" />
                <span className="font-semibold">Tốt</span>
                <span className="text-xs text-emerald-400">Nhớ rõ</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== FLIP CARD COMPONENT ==========
function FlipCard({ card, index, onDelete, onExpand }: { card: FlashcardDto; index: number; onDelete: () => void; onExpand: () => void }) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="perspective-1000 h-56 cursor-pointer group"
      onClick={onExpand}
    >
      <div 
        className={cn(
          "relative w-full h-full transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-xl",
          isFlipped ? "rotate-y-180" : ""
        )}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div 
          className="absolute inset-0 rounded-xl bg-white shadow-md border-2 border-transparent group-hover:border-primary/30 group-hover:shadow-xl transition-all duration-300 flex flex-col p-5"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="px-3 py-1 rounded-md bg-primary/10 text-primary text-sm font-bold">CÂU HỎI</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">#{index + 1}</span>
              <span className="p-1.5 rounded-md bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="h-4 w-4" />
              </span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-base font-medium text-slate-800 text-center leading-relaxed line-clamp-3">
              {card.frontContent}
            </p>
          </div>
          <div className="flex items-center justify-center gap-1 text-slate-400 mt-3">
            <FlipHorizontal className="h-4 w-4" />
            <span className="text-sm">Click để xem chi tiết</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'red' | 'amber' | 'blue' | 'emerald'; }) {
  const colorMap = {
    red: { bg: 'bg-red-50', border: 'border-red-100', icon: 'text-red-500', text: 'text-red-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-500', text: 'text-amber-600' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'text-blue-500', text: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'text-emerald-500', text: 'text-emerald-600' },
  };
  const c = colorMap[color];
  
  return (
    <div className={cn("bg-white rounded-xl p-5 border transition-all hover:shadow-md", c.bg, c.border)}>
      <div className={cn("flex items-center gap-3 mb-2", c.icon)}>
        {icon}
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold", c.text)}>{value}</p>
    </div>
  );
}
