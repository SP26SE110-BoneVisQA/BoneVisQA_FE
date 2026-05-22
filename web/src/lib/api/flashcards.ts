'use client';

import { http, getApiErrorMessage } from './client';

export interface FlashcardDto {
  id: string;
  deckId: string;
  frontContent: string;
  backContent: string;
  sourceType?: string;
  sourceId?: string;
  difficulty?: string;
  timesReviewed: number;
  timesCorrect: number;
  nextReviewDate?: string;
  createdAt: string;
  isBookmarked?: boolean;
  bookmarkedAt?: string;
}

export interface FlashcardDeckDto {
  id: string;
  studentId: string;
  deckName: string;
  description?: string;
  sourceType?: string;
  totalCards: number;
  cardsStudied: number;
  masteredCards: number;
  lastStudiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardStatsDto {
  totalDecks: number;
  totalCards: number;
  cardsStudied: number;
  masteredCards: number;
  dueToday: number;
  streak: number;
}

export interface FlashcardStudySessionDto {
  deckId: string;
  deckName: string;
  cards: FlashcardDto[];
  currentIndex: number;
  totalCards: number;
  masteredCount: number;
  reviewedCount: number;
}

export interface FlashcardGenerationResultDto {
  success: boolean;
  deckName?: string;
  deckId?: string;
  generatedCount: number;
  failedCount: number;
  generatedCards: FlashcardDto[];
  errorMessage?: string;
}

// ===== Deck APIs =====

export async function fetchFlashcardDecks(): Promise<FlashcardDeckDto[]> {
  try {
    const { data } = await http.get<unknown>('/api/student/flashcards/decks');
    const list = Array.isArray(data) ? data : [];
    return (list as Record<string, unknown>[]).map(mapDeck);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchFlashcardDeck(deckId: string): Promise<FlashcardDeckDto> {
  try {
    const { data } = await http.get<unknown>(`/api/student/flashcards/decks/${deckId}`);
    return mapDeck(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function createFlashcardDeck(name: string, description?: string): Promise<FlashcardDeckDto> {
  try {
    const { data } = await http.post<unknown>('/api/student/flashcards/decks', {
      deckName: name,
      description,
    });
    return mapDeck(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateFlashcardDeck(
  deckId: string,
  name: string,
  description?: string
): Promise<FlashcardDeckDto> {
  try {
    const { data } = await http.put<unknown>(`/api/student/flashcards/decks/${deckId}`, {
      deckName: name,
      description,
    });
    return mapDeck(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function deleteFlashcardDeck(deckId: string): Promise<void> {
  try {
    await http.delete(`/api/student/flashcards/decks/${deckId}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ===== Flashcard APIs =====

export async function fetchFlashcardsByDeck(deckId: string): Promise<FlashcardDto[]> {
  try {
    const { data } = await http.get<unknown>(`/api/student/flashcards/decks/${deckId}/cards`);
    const list = Array.isArray(data) ? data : [];
    return (list as Record<string, unknown>[]).map(mapCard);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function createFlashcard(
  deckId: string,
  frontContent: string,
  backContent: string
): Promise<FlashcardDto> {
  try {
    const { data } = await http.post<unknown>('/api/student/flashcards/cards', {
      deckId,
      frontContent,
      backContent,
    });
    return mapCard(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateFlashcard(
  cardId: string,
  frontContent: string,
  backContent: string
): Promise<FlashcardDto> {
  try {
    const { data } = await http.put<unknown>(`/api/student/flashcards/cards/${cardId}`, {
      frontContent,
      backContent,
    });
    return mapCard(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function deleteFlashcard(cardId: string): Promise<void> {
  try {
    await http.delete(`/api/student/flashcards/cards/${cardId}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ===== Study APIs =====

export async function fetchStudySession(deckId: string): Promise<FlashcardStudySessionDto> {
  try {
    const { data } = await http.get<unknown>(`/api/student/flashcards/study/${deckId}`);
    return mapStudySession(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function submitFlashcardReview(
  cardId: string,
  quality: number
): Promise<{ nextReviewDate: string; newInterval: number }> {
  try {
    const { data } = await http.post<unknown>('/api/student/flashcards/review', {
      cardId,
      quality,
    });
    const item = data as Record<string, unknown>;
    return {
      nextReviewDate: String(item.nextReviewDate ?? ''),
      newInterval: Number(item.newInterval ?? 0),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchFlashcardStats(): Promise<FlashcardStatsDto> {
  try {
    const { data } = await http.get<unknown>('/api/student/flashcards/stats');
    const item = data as Record<string, unknown>;
    return {
      totalDecks: Number(item.totalDecks ?? 0),
      totalCards: Number(item.totalCards ?? 0),
      cardsStudied: Number(item.cardsStudied ?? 0),
      masteredCards: Number(item.masteredCards ?? 0),
      dueToday: Number(item.dueToday ?? 0),
      streak: Number(item.streak ?? 0),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ===== Bookmark APIs =====

export async function toggleFlashcardBookmark(cardId: string): Promise<FlashcardDto> {
  try {
    const { data } = await http.post<unknown>(`/api/student/flashcards/bookmark/${cardId}`);
    return mapCard(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchBookmarkedCards(): Promise<{ bookmarkedCards: FlashcardDto[]; totalBookmarked: number }> {
  try {
    const { data } = await http.get<unknown>('/api/student/flashcards/bookmarks');
    const item = data as Record<string, unknown>;
    const cardsRaw = item.bookmarkedCards ?? item.BookmarkedCards ?? [];
    const cards = Array.isArray(cardsRaw) ? cardsRaw : [];
    return {
      bookmarkedCards: cards.map(mapCard),
      totalBookmarked: Number(item.totalBookmarked ?? item.TotalBookmarked ?? 0),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchBookmarkedStudySession(): Promise<FlashcardStudySessionDto> {
  try {
    const { data } = await http.get<unknown>('/api/student/flashcards/study/bookmarks');
    return mapStudySession(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ===== Import APIs =====

export interface ImportFlashcardItem {
  frontContent: string;
  backContent: string;
  imageUrl?: string;
}

export interface ImportFlashcardsResult {
  success: boolean;
  importedCount: number;
  failedCount: number;
  errors: string[];
  importedCards: FlashcardDto[];
}

export async function importFlashcards(
  deckId: string,
  cards: ImportFlashcardItem[]
): Promise<ImportFlashcardsResult> {
  try {
    const { data } = await http.post<unknown>('/api/student/flashcards/import', {
      deckId,
      cards,
    });
    const item = data as Record<string, unknown>;
    const cardsRaw = item.importedCards ?? item.ImportedCards ?? [];
    const cardsList = Array.isArray(cardsRaw) ? cardsRaw : [];
    const errorsArray = item.errors ?? item.Errors;
    const errors: string[] = Array.isArray(errorsArray)
      ? (errorsArray as unknown[]).map(String)
      : [];
    return {
      success: Boolean(item.success ?? item.Success ?? false),
      importedCount: Number(item.importedCount ?? item.ImportedCount ?? 0),
      failedCount: Number(item.failedCount ?? item.FailedCount ?? 0),
      errors,
      importedCards: cardsList.map(mapCard),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ===== Generator APIs =====

export async function generateFlashcardsFromCase(
  caseId: string,
  cardCount = 10
): Promise<FlashcardGenerationResultDto> {
  try {
    const { data } = await http.post<unknown>(
      `/api/student/flashcards/generate/from-case/${caseId}?cardCount=${cardCount}`
    );
    return mapGenerationResult(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function generateFlashcardsFromDocument(
  documentId: string,
  cardCount = 10
): Promise<FlashcardGenerationResultDto> {
  try {
    const { data } = await http.post<unknown>(
      `/api/student/flashcards/generate/from-document/${documentId}?cardCount=${cardCount}`
    );
    return mapGenerationResult(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function generateFlashcardsFromText(
  sourceText: string,
  deckName?: string,
  cardCount = 10
): Promise<FlashcardGenerationResultDto> {
  try {
    const { data } = await http.post<unknown>('/api/student/flashcards/generate/from-text', {
      sourceText,
      deckName,
      cardCount,
    });
    return mapGenerationResult(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

// ===== Mappers =====

function pickStr(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length) return s;
  }
  return null;
}

function mapDeck(item: unknown): FlashcardDeckDto {
  const r = item as Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    studentId: String(r.studentId ?? ''),
    deckName: String(r.deckName ?? 'Untitled Deck'),
    description: pickStr(r, 'description', 'Description') ?? undefined,
    sourceType: pickStr(r, 'sourceType', 'SourceType') ?? undefined,
    totalCards: Number(r.cardCount ?? r.CardCount ?? r.totalCards ?? 0),
    cardsStudied: Number(r.cardsStudied ?? r.CardsStudied ?? 0),
    masteredCards: Number(r.masteredCards ?? r.MasteredCards ?? 0),
    lastStudiedAt: pickStr(r, 'lastStudiedAt', 'lastStudiedAt', 'LastStudiedAt') ?? undefined,
    createdAt: String(r.createdAt ?? r.createdAt ?? new Date().toISOString()),
    updatedAt: String(r.updatedAt ?? r.updatedAt ?? new Date().toISOString()),
  };
}

function mapCard(item: unknown): FlashcardDto {
  const r = item as Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    deckId: String(r.deckId ?? ''),
    frontContent: String(r.frontContent ?? ''),
    backContent: String(r.backContent ?? ''),
    sourceType: pickStr(r, 'sourceType', 'SourceType') ?? undefined,
    sourceId: pickStr(r, 'sourceId', 'SourceId') ?? undefined,
    difficulty: pickStr(r, 'difficulty', 'Difficulty') ?? undefined,
    timesReviewed: Number(r.timesReviewed ?? r.TimesReviewed ?? 0),
    timesCorrect: Number(r.timesCorrect ?? r.TimesCorrect ?? 0),
    nextReviewDate: pickStr(r, 'nextReviewDate', 'NextReviewDate') ?? undefined,
    createdAt: String(r.createdAt ?? new Date().toISOString()),
    isBookmarked: Boolean(r.isBookmarked ?? r.IsBookmarked ?? false),
    bookmarkedAt: pickStr(r, 'bookmarkedAt', 'BookmarkedAt') ?? undefined,
  };
}

function mapStudySession(item: unknown): FlashcardStudySessionDto {
  const r = item as Record<string, unknown>;
  const cardsRaw = r.cards ?? r.cards ?? [];
  const cards = Array.isArray(cardsRaw) ? cardsRaw : [];
  return {
    deckId: String(r.deckId ?? ''),
    deckName: String(r.deckName ?? 'Study Session'),
    cards: cards.map(mapCard),
    currentIndex: Number(r.currentIndex ?? 0),
    totalCards: Number(r.totalCards ?? cards.length),
    masteredCount: Number(r.masteredCount ?? 0),
    reviewedCount: Number(r.reviewedCount ?? 0),
  };
}

function mapGenerationResult(item: unknown): FlashcardGenerationResultDto {
  const r = item as Record<string, unknown>;
  const cardsRaw = r.generatedCards ?? r.cards ?? [];
  const cards = Array.isArray(cardsRaw) ? cardsRaw : [];
  return {
    success: Boolean(r.success ?? false),
    deckName: pickStr(r, 'deckName', 'DeckName') ?? undefined,
    deckId: pickStr(r, 'deckId', 'DeckId') ?? undefined,
    generatedCount: Number(r.generatedCount ?? 0),
    failedCount: Number(r.failedCount ?? 0),
    generatedCards: cards.map(mapCard),
    errorMessage: pickStr(r, 'errorMessage', 'ErrorMessage') ?? undefined,
  };
}
