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
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Zap,
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
} from 'lucide-react';

export default function FlashcardReviewPage() {
  const [dueReviews, setDueReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<SpacedRepetitionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentReview, setCurrentReview] = useState<ReviewItem | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // AI Recommendations
  const [recommendations, setRecommendations] = useState<{
    success: boolean;
    masteryScore: number;
    studyTips?: string;
    suggestedTopics: string[];
    weakAreas: string[];
  } | null>(null);

  // Flashcard Decks
  const [decks, setDecks] = useState<FlashcardDeckDto[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDescription, setNewDeckDescription] = useState('');
  const [creatingDeck, setCreatingDeck] = useState(false);

  // Single Card Creation
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');
  const [creatingCard, setCreatingCard] = useState(false);

  // Deck Detail View
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeckDto | null>(null);
  const [deckCards, setDeckCards] = useState<FlashcardDto[]>([]);
  const [loadingDeckCards, setLoadingDeckCards] = useState(false);

  // View Mode: 'grid' or 'single'
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [singleCardFlipped, setSingleCardFlipped] = useState(false);

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

  const handleDeleteDeck = async (deckId: string) => {
    try {
      await deleteFlashcardDeck(deckId);
      setDecks(decks.filter(d => d.id !== deckId));
    } catch (error) {
      console.error('Error deleting deck:', error);
    }
  };

  const handleViewDeck = async (deck: FlashcardDeckDto) => {
    setSelectedDeck(deck);
    setLoadingDeckCards(true);
    setCurrentCardIndex(0);
    setSingleCardFlipped(false);
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

  // Single Card Mode Controls
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
            <div className="h-20 bg-muted rounded-2xl" />
            <div className="h-96 bg-muted rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // ========== DECK DETAIL ==========
  if (selectedDeck) {
    const currentCard = deckCards[currentCardIndex];
    const progress = deckCards.length > 0 ? ((currentCardIndex + 1) / deckCards.length) * 100 : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => setSelectedDeck(null)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại
                </Button>
                <div>
                  <h1 className="font-bold text-lg">{selectedDeck.deckName}</h1>
                  <p className="text-sm text-muted-foreground">{deckCards.length} thẻ</p>
                </div>
              </div>
              <div className="flex gap-2">
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
                        <Textarea value={newCardFront} onChange={(e) => setNewCardFront(e.target.value)} placeholder="..." rows={3} />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Mặt sau (Đáp án)</label>
                        <Textarea value={newCardBack} onChange={(e) => setNewCardBack(e.target.value)} placeholder="..." rows={3} />
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
            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2",
                  viewMode === 'grid' 
                    ? "bg-white shadow-sm text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Grid3X3 className="h-4 w-4" />
                Grid View
              </button>
              <button
                onClick={() => { setViewMode('single'); setCurrentCardIndex(0); setSingleCardFlipped(false); }}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2",
                  viewMode === 'single' 
                    ? "bg-white shadow-sm text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BookText className="h-4 w-4" />
                1 Card
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-6">
          {loadingDeckCards ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : deckCards.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <Layers className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground mb-4">Chưa có thẻ nào</p>
              <Button onClick={() => setShowCreateCard(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Thêm thẻ đầu tiên
              </Button>
            </div>
          ) : viewMode === 'single' ? (
            // ========== SINGLE CARD VIEW ==========
            <div className="space-y-6">
              {/* Progress */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Card {currentCardIndex + 1} / {deckCards.length}</span>
                  <Button variant="ghost" size="sm" onClick={shuffleCards} className="gap-1 h-7 text-xs">
                    <Shuffle className="h-3 w-3" /> Xáo
                  </Button>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-[#007BFF] rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {/* Single Card */}
              <div 
                className="relative h-56 cursor-pointer"
                onClick={() => setSingleCardFlipped(!singleCardFlipped)}
              >
                <div className={cn(
                  "absolute inset-0 transition-all duration-300",
                  singleCardFlipped ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
                )}>
                  {/* Front */}
                  <div className="absolute inset-0 rounded-2xl bg-white shadow-lg border-2 border-slate-200 p-6 flex flex-col items-center justify-center">
                    <span className="text-xs font-medium text-primary uppercase tracking-wider mb-3">Câu hỏi</span>
                    <p className="text-base font-medium text-center leading-relaxed line-clamp-3">{currentCard?.frontContent}</p>
                    <div className="absolute bottom-3 flex items-center gap-2 text-muted-foreground">
                      <FlipHorizontal className="h-4 w-4" />
                      <span className="text-xs">Nhấn để lật</span>
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "absolute inset-0 transition-all duration-300",
                  singleCardFlipped ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                )}>
                  {/* Back */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg p-6 flex flex-col items-center justify-center text-white">
                    <span className="text-xs font-medium uppercase tracking-wider mb-3 opacity-80">Đáp án</span>
                    <p className="text-base font-medium text-center leading-relaxed line-clamp-3">{currentCard?.backContent}</p>
                    <div className="absolute bottom-3 flex items-center gap-2 text-white/70">
                      <FlipHorizontal className="h-4 w-4" />
                      <span className="text-xs">Nhấn để lật lại</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-center gap-4">
                <Button 
                  variant="outline" 
                  onClick={prevCard} 
                  disabled={currentCardIndex === 0}
                  className="h-12 w-12 rounded-full"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                
                <div className="flex gap-1">
                  {deckCards.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setCurrentCardIndex(idx); setSingleCardFlipped(false); }}
                      className={cn(
                        "w-3 h-3 rounded-full transition-all",
                        idx === currentCardIndex ? "bg-primary scale-125" : "bg-slate-300 hover:bg-slate-400"
                      )}
                    />
                  ))}
                </div>

                <Button 
                  variant="outline" 
                  onClick={nextCard} 
                  disabled={currentCardIndex === deckCards.length - 1}
                  className="h-12 w-12 rounded-full"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ) : (
            // ========== GRID VIEW ==========
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {deckCards.map((card, idx) => (
                <FlipCard key={card.id} card={card} index={idx} onDelete={() => handleDeleteCard(card.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== MAIN VIEW ==========
  if (!currentReview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
        <Header title="Flashcard Review" subtitle="Spaced repetition for better retention" />
        
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
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
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Điểm Thành Thạo AI</h3>
                    <p className="text-sm text-muted-foreground">Dựa trên lịch sử học tập</p>
                  </div>
                </div>
                <span className={cn("text-3xl font-bold", recommendations.masteryScore >= 60 ? "text-emerald-500" : "text-amber-500")}>
                  {recommendations.masteryScore}%
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", recommendations.masteryScore >= 60 ? "bg-emerald-500" : "bg-amber-500")}
                  style={{ width: `${recommendations.masteryScore}%` }}
                />
              </div>
            </div>
          )}

          {/* Decks List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Bộ Flashcard Của Tôi
              </h2>
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
                      <Textarea value={newDeckDescription} onChange={(e) => setNewDeckDescription(e.target.value)} placeholder="..." rows={2} />
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

            <div className="p-6">
              {loadingDecks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : decks.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground mb-4">Chưa có bộ flashcard nào</p>
                  <Button onClick={() => setShowCreateDeck(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Tạo Bộ Đầu Tiên
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {decks.map((deck) => (
                    <div key={deck.id} className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer" onClick={() => handleViewDeck(deck)}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                          <BookMarked className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{deck.deckName}</h3>
                          <p className="text-sm text-muted-foreground">{deck.cardCount} thẻ</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteDeck(deck.id); }} className="opacity-0 group-hover:opacity-100 text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Empty State */}
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Tuyệt vời!</h2>
            <p className="text-muted-foreground mb-6">Bạn đã hoàn thành hết các thẻ ôn tập trong ngày.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="bg-gradient-to-r from-primary to-[#007BFF]">
                <Link href="/student/quizzes?tab=practice"><Target className="h-5 w-5 mr-2" />Làm Quiz</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/student/dashboard">Dashboard</Link>
              </Button>
            </div>
          </div>

          {/* AI Tips */}
          {recommendations?.success && recommendations.studyTips && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-200">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <BrainCircuit className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-purple-900 mb-1">Gợi Ý Từ AI</h3>
                  <p className="text-sm text-purple-800">{recommendations.studyTips}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <Header title="Flashcard Review" subtitle="Spaced repetition for better retention" />
      
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Progress */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Tiến độ ôn tập</span>
            <span className="text-sm text-muted-foreground">{dueReviews.length} thẻ còn lại</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-[#007BFF] rounded-full transition-all" style={{ width: `${((20 - dueReviews.length) / 20) * 100}%` }} />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild><Link href="/student/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Link></Button>
          <Button variant="ghost" onClick={handleSkip} className="gap-2 text-muted-foreground">Bỏ qua<ChevronRight className="h-4 w-4" /></Button>
        </div>

        {/* Case Info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span>{currentReview.caseTitle}</span>
          <span className="ml-auto text-xs bg-slate-100 px-2 py-1 rounded-full"><Clock className="h-3 w-3 inline mr-1" />{currentReview.repetitionCount}x</span>
        </div>

        {/* Flashcard */}
        <div className="relative h-80 cursor-pointer" onClick={handleFlip}>
          <div className={cn("absolute inset-0 transition-transform duration-500 transform-style-preserve-3d", isFlipped && "rotate-y-180")}>
            <div className={cn("absolute inset-0 rounded-2xl bg-white shadow-xl border-2 border-slate-200 p-8 flex flex-col items-center justify-center backface-hidden", isFlipped && "invisible")}>
              <p className="text-xl font-medium text-center leading-relaxed">{currentReview.questionText}</p>
              <div className="absolute bottom-4 flex items-center gap-2 text-muted-foreground">
                <FlipHorizontal className="h-5 w-5" />
                <span className="text-sm">Nhấn để lật</span>
              </div>
            </div>
            <div className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-xl p-8 flex flex-col items-center justify-center text-white backface-hidden", !isFlipped && "invisible")}>
              <p className="text-xl font-medium text-center leading-relaxed">{currentReview.correctAnswer}</p>
            </div>
          </div>
        </div>

        {/* Rating */}
        {!showAnswer ? (
          <Button onClick={() => setShowAnswer(true)} className="w-full h-14 text-lg font-medium bg-gradient-to-r from-primary to-[#007BFF]">
            <Eye className="h-5 w-5 mr-2" />Xem Đáp Án
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm font-medium text-muted-foreground">Bạn trả lời như thế nào?</p>
            <div className="grid grid-cols-3 gap-3">
              <Button onClick={() => handleReview(0)} disabled={processing} className="h-auto py-4 flex-col gap-1 bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100">
                <XCircle className="h-6 w-6" /><span className="font-semibold">Lại</span><span className="text-xs opacity-70">Không nhớ</span>
              </Button>
              <Button onClick={() => handleReview(3)} disabled={processing} className="h-auto py-4 flex-col gap-1 bg-amber-50 border-2 border-amber-200 text-amber-600 hover:bg-amber-100">
                <TrendingUp className="h-6 w-6" /><span className="font-semibold">Khó</span><span className="text-xs opacity-70">Nhớ lúc được</span>
              </Button>
              <Button onClick={() => handleReview(4)} disabled={processing} className="h-auto py-4 flex-col gap-1 bg-emerald-50 border-2 border-emerald-200 text-emerald-600 hover:bg-emerald-100">
                <CheckCircle className="h-6 w-6" /><span className="font-semibold">Tốt</span><span className="text-xs opacity-70">Nhớ rõ</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== FLIP CARD COMPONENT ==========
function FlipCard({ card, index, onDelete }: { card: FlashcardDto; index: number; onDelete: () => void }) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="group relative h-36">
      <div 
        className={cn(
          "absolute inset-0 transition-all duration-300 cursor-pointer",
          isFlipped ? "opacity-0 translate-x-2" : "opacity-100 translate-x-0"
        )}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Front */}
        <div className="absolute inset-0 rounded-lg bg-white shadow-sm border border-slate-200 p-3 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-primary">Q</span>
            <span className="text-xs text-muted-foreground">{index + 1}</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs font-medium text-center leading-tight line-clamp-3">{card.frontContent}</p>
          </div>
        </div>
      </div>
      <div 
        className={cn(
          "absolute inset-0 transition-all duration-300 cursor-pointer",
          isFlipped ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
        )}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Back */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm p-3 flex flex-col text-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium opacity-80">A</span>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs font-medium text-center leading-tight line-clamp-3">{card.backContent}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'red' | 'amber' | 'blue' | 'emerald'; }) {
  const colors = { red: 'bg-red-50 text-red-600 border-red-200', amber: 'bg-amber-50 text-amber-600 border-amber-200', blue: 'bg-blue-50 text-blue-600 border-blue-200', emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
  return (
    <div className={cn("bg-white rounded-xl p-4 shadow-sm border transition-transform hover:scale-[1.02]", colors[color])}>
      <div className="flex items-center gap-3 mb-2">{icon}<span className="text-sm font-medium">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
