'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchFlashcardDeck,
  fetchFlashcardsByDeck,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
  importFlashcards,
  toggleFlashcardBookmark,
  type FlashcardDeckDto,
  type FlashcardDto,
  type ImportFlashcardItem,
} from '@/lib/api/flashcards';
import {
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  BookOpen,
  Check,
  X,
  Save,
  Upload,
  FileSpreadsheet,
  Download,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';

interface CardFormData {
  frontContent: string;
  backContent: string;
}

function CreateCardDialog({
  open,
  onClose,
  onCreated,
  deckId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (card: FlashcardDto) => void;
  deckId: string;
}) {
  const [form, setForm] = useState<CardFormData>({ frontContent: '', backContent: '' });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleCreate = async () => {
    if (!form.frontContent.trim() || !form.backContent.trim()) return;
    setLoading(true);
    try {
      const card = await createFlashcard(deckId, form.frontContent.trim(), form.backContent.trim());
      onCreated(card);
      setForm({ frontContent: '', backContent: '' });
      onClose();
      toast.success('Card created successfully!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create card');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setForm({ frontContent: '', backContent: '' });
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Create New Card</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Front (Question)</label>
            <textarea
              placeholder="Enter the question or term..."
              value={form.frontContent}
              onChange={(e) => setForm((f) => ({ ...f, frontContent: e.target.value }))}
              className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Back (Answer)</label>
            <textarea
              placeholder="Enter the answer or definition..."
              value={form.backContent}
              onChange={(e) => setForm((f) => ({ ...f, backContent: e.target.value }))}
              className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!form.frontContent.trim() || !form.backContent.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Card
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditCardDialog({
  open,
  onClose,
  card,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  card: FlashcardDto | null;
  onSaved: (card: FlashcardDto) => void;
}) {
  const [form, setForm] = useState<CardFormData>({ frontContent: '', backContent: '' });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open && card) {
      setForm({ frontContent: card.frontContent, backContent: card.backContent });
    }
  }, [open, card]);

  const handleSave = async () => {
    if (!card || !form.frontContent.trim() || !form.backContent.trim()) return;
    setLoading(true);
    try {
      const updated = await updateFlashcard(card.id, form.frontContent.trim(), form.backContent.trim());
      onSaved(updated);
      onClose();
      toast.success('Card updated successfully!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update card');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Edit Card</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Front (Question)</label>
            <textarea
              placeholder="Enter the question or term..."
              value={form.frontContent}
              onChange={(e) => setForm((f) => ({ ...f, frontContent: e.target.value }))}
              className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Back (Answer)</label>
            <textarea
              placeholder="Enter the answer or definition..."
              value={form.backContent}
              onChange={(e) => setForm((f) => ({ ...f, backContent: e.target.value }))}
              className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!form.frontContent.trim() || !form.backContent.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteCardDialog({
  card,
  onClose,
  onDeleted,
}: {
  card: FlashcardDto | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleDelete = async () => {
    if (!card) return;
    setLoading(true);
    try {
      await deleteFlashcard(card.id);
      onDeleted();
      onClose();
      toast.success('Card deleted successfully!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete card');
    } finally {
      setLoading(false);
    }
  };

  if (!card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Delete Card?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to delete this card? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImportCardsDialog({
  open,
  onClose,
  deckId,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  deckId: string;
  onImported: (count: number) => void;
}) {
  const [cards, setCards] = useState<ImportFlashcardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const parseCSV = (text: string): ImportFlashcardItem[] => {
    const lines = text.trim().split('\n');
    const result: ImportFlashcardItem[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Simple CSV parsing - split by comma, handling quoted values
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim());
      
      if (parts.length >= 2 && parts[0] && parts[1]) {
        result.push({
          frontContent: parts[0].replace(/^"|"$/g, ''),
          backContent: parts[1].replace(/^"|"$/g, ''),
        });
      }
    }
    
    return result;
  };

  const parseJSON = (text: string): ImportFlashcardItem[] => {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        return data
          .filter((item: Record<string, unknown>) => item.frontContent || item.front || item.question)
          .map((item: Record<string, unknown>) => ({
            frontContent: String(item.frontContent || item.front || item.question || ''),
            backContent: String(item.backContent || item.back || item.answer || ''),
          }));
      }
      return [];
    } catch {
      return [];
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const isJSON = file.name.endsWith('.json');
      const parsed = isJSON ? parseJSON(text) : parseCSV(text);
      
      if (parsed.length === 0) {
        toast.error('No valid cards found in file');
        return;
      }
      
      setCards(parsed);
      toast.success(`Parsed ${parsed.length} cards from file`);
    };
    reader.readAsText(file);
  };

  const handleManualAdd = () => {
    setCards([...cards, { frontContent: '', backContent: '' }]);
  };

  const handleManualChange = (index: number, field: 'frontContent' | 'backContent', value: string) => {
    setCards(cards.map((card, i) => 
      i === index ? { ...card, [field]: value } : card
    ));
  };

  const handleManualRemove = (index: number) => {
    setCards(cards.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    const validCards = cards.filter(c => c.frontContent.trim() && c.backContent.trim());
    if (validCards.length === 0) {
      toast.error('No valid cards to import');
      return;
    }

    setImporting(true);
    try {
      const result = await importFlashcards(deckId, validCards);
      if (result.success) {
        toast.success(`Successfully imported ${result.importedCount} cards!`);
        onImported(result.importedCount);
        onClose();
        setCards([]);
      } else {
        toast.error(`Imported ${result.importedCount} cards with ${result.failedCount} failures`);
        if (result.importedCount > 0) {
          onImported(result.importedCount);
          onClose();
          setCards([]);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to import cards');
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleCSV = () => {
    const csv = 'frontContent,backContent\n"What is the femur?","The thigh bone, the longest bone in the human body"\n"Types of bone fractures?","Transverse, oblique, comminuted, spiral, greenstick"';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_flashcards.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleJSON = () => {
    const json = JSON.stringify([
      { frontContent: "What is the femur?", backContent: "The thigh bone, the longest bone in the human body" },
      { frontContent: "Types of bone fractures?", backContent: "Transverse, oblique, comminuted, spiral, greenstick" }
    ], null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_flashcards.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (open) {
      setCards([]);
      setLoading(false);
      setImporting(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Import Flashcards</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* File Upload */}
          <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">Upload CSV or JSON file</p>
            <p className="mt-1 text-xs text-muted-foreground">
              CSV: frontContent,backContent | JSON: array of objects
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose File
            </Button>
          </div>

          {/* Sample Templates */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Download templates:</span>
            <Button variant="ghost" size="sm" onClick={downloadSampleCSV}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadSampleJSON}>
              <Download className="mr-1 h-4 w-4" />
              JSON
            </Button>
          </div>

          {/* Manual Add */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              Or add cards manually ({cards.length} cards)
            </h3>
            <Button variant="outline" size="sm" onClick={handleManualAdd}>
              <Plus className="mr-1 h-4 w-4" />
              Add Card
            </Button>
          </div>

          {cards.length > 0 && (
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {cards.map((card, index) => (
                <div key={index} className="flex items-start gap-2 rounded-lg border border-border p-2">
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Question (front)"
                      value={card.frontContent}
                      onChange={(e) => handleManualChange(index, 'frontContent', e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Answer (back)"
                      value={card.backContent}
                      onChange={(e) => handleManualChange(index, 'backContent', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <button
                    onClick={() => handleManualRemove(index)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={cards.filter(c => c.frontContent.trim() && c.backContent.trim()).length === 0 || importing}
          >
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import {cards.filter(c => c.frontContent.trim() && c.backContent.trim()).length} Cards
          </Button>
        </div>
      </div>
    </div>
  );
}

function FlashcardListItem({
  card,
  index,
  onEdit,
  onDelete,
  onBookmark,
  bookmarking,
}: {
  card: FlashcardDto;
  index: number;
  onEdit: (card: FlashcardDto) => void;
  onDelete: (card: FlashcardDto) => void;
  onBookmark: (card: FlashcardDto) => void;
  bookmarking: boolean;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-md">
      <div className="flex items-stretch">
        <button
          onClick={() => setFlipped(!flipped)}
          className="flex min-w-0 flex-1 items-center p-4 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                #{index + 1}
              </span>
              {card.sourceType && (
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                  {card.sourceType}
                </span>
              )}
            </div>
            <p className="mt-2 truncate text-sm font-medium text-foreground">
              {flipped ? card.backContent : card.frontContent}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {flipped ? 'Answer' : 'Question'} • Click to {flipped ? 'see question' : 'see answer'}
            </p>
          </div>
        </button>
        <div className="flex items-center border-l border-border">
          <button
            onClick={() => onBookmark(card)}
            disabled={bookmarking}
            className={`flex h-full items-center px-3 transition-colors ${
              card.isBookmarked
                ? 'text-primary hover:bg-primary/10'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title={card.isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
          >
            {bookmarking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : card.isBookmarked ? (
              <BookmarkCheck className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => onEdit(card)}
            className="flex h-full items-center px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(card)}
            className="flex h-full items-center px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManageFlashcardsPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const deckId = params.id as string;

  const [deck, setDeck] = useState<FlashcardDeckDto | null>(null);
  const [cards, setCards] = useState<FlashcardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<FlashcardDto | null>(null);
  const [cardToDelete, setCardToDelete] = useState<FlashcardDto | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkingCardId, setBookmarkingCardId] = useState<string | null>(null);

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

  const handleCardCreated = (card: FlashcardDto) => {
    setCards((prev) => [...prev, card]);
  };

  const handleCardSaved = (updated: FlashcardDto) => {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleCardDeleted = () => {
    if (cardToDelete) {
      setCards((prev) => prev.filter((c) => c.id !== cardToDelete.id));
      setCardToDelete(null);
    }
  };

  const handleBookmark = async (card: FlashcardDto) => {
    setBookmarkingCardId(card.id);
    try {
      const updated = await toggleFlashcardBookmark(card.id);
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(
        updated.isBookmarked
          ? 'Card added to bookmarks!'
          : 'Card removed from bookmarks'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update bookmark');
    } finally {
      setBookmarkingCardId(null);
    }
  };

  const handleCardsImported = (count: number) => {
    void loadData();
  };

  const filteredCards = cards.filter(
    (card) =>
      card.frontContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.backContent.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title={deck?.deckName ?? 'Manage Flashcards'}
        subtitle="Create and manage flashcards in this deck"
      />
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/student/flashcards"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Decks
          </Link>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Card
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
        </div>

        {cards.length > 0 && (
          <div className="mb-4">
            <Input
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
          </div>
        )}

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No flashcards yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Add your first flashcard to this deck to start learning.
            </p>
            <Button className="mt-6" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Card
            </Button>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
            <p className="text-muted-foreground">No cards match your search.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {filteredCards.length} of {cards.length} cards
            </p>
            {filteredCards.map((card, index) => (
              <FlashcardListItem
                key={card.id}
                card={card}
                index={index}
                onEdit={setCardToEdit}
                onDelete={setCardToDelete}
                onBookmark={handleBookmark}
                bookmarking={bookmarkingCardId === card.id}
              />
            ))}
          </div>
        )}
      </div>

      <CreateCardDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleCardCreated}
        deckId={deckId}
      />

      <EditCardDialog
        open={!!cardToEdit}
        onClose={() => setCardToEdit(null)}
        card={cardToEdit}
        onSaved={handleCardSaved}
      />

      <DeleteCardDialog
        card={cardToDelete}
        onClose={() => setCardToDelete(null)}
        onDeleted={handleCardDeleted}
      />

      <ImportCardsDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        deckId={deckId}
        onImported={handleCardsImported}
      />
    </div>
  );
}
