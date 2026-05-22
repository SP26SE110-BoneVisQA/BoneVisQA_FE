'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { StudentAppChrome } from '@/components/student/StudentAppChrome';
import { ChatComposer } from '@/components/student/ChatComposer';
import { ChatConversation } from '@/components/student/ChatConversation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  ArrowLeft,
  BookOpen,
  Search,
  Send,
  Bot,
  Sparkles,
  ChevronDown,
  Bone,
  Activity,
  AlertTriangle,
  Stethoscope,
  HeartPulse,
  Brain,
  Microscope,
  BoneIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Topic {
  id: string;
  label: string;
  description: string;
}

interface TopicCategory {
  id: string;
  category: string;
  topics: Topic[];
  icon: typeof Bone;
  color: string;
  bgColor: string;
  borderColor: string;
}

const topicCategories: TopicCategory[] = [
  {
    id: 'upper-extremity',
    category: 'Upper Extremity',
    icon: Bone,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    borderColor: 'border-blue-200 hover:border-blue-400',
    topics: [
      { id: 'shoulder', label: 'Shoulder & Glenohumeral', description: 'Rotator cuff, labrum, biceps tendon' },
      { id: 'elbow', label: 'Elbow & Radioulnar', description: 'Tennis elbow, golfer elbow, dislocation' },
      { id: 'wrist', label: 'Wrist & Radiocarpal', description: 'Carpal tunnel, scaphoid fracture' },
      { id: 'hand', label: 'Hand & Carpals', description: 'Metacarpals, phalanges, ganglia' },
      { id: 'fingers', label: 'Fingers & Phalanges', description: 'Mallet finger, Boutonniere deformity' },
      { id: 'clavicle', label: 'Clavicle & Scapula', description: 'AC joint, scapular winging' },
    ],
  },
  {
    id: 'lower-extremity',
    category: 'Lower Extremity',
    icon: Activity,
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100',
    borderColor: 'border-green-200 hover:border-green-400',
    topics: [
      { id: 'hip', label: 'Hip & Acetabulum', description: 'Femoral neck fracture, hip dysplasia' },
      { id: 'knee', label: 'Knee & Meniscus', description: 'ACL, MCL, meniscal tears' },
      { id: 'ankle', label: 'Ankle & Talocrural', description: 'Ankle fracture, Achilles tendon' },
      { id: 'foot', label: 'Foot & Tarsals', description: 'Calcaneus, metatarsal stress fractures' },
      { id: 'femur', label: 'Femur & Tibia', description: 'Shaft fractures, tibial plateau' },
      { id: 'patella', label: 'Patella & Fibula', description: 'Patellar fracture, fibular stress' },
    ],
  },
  {
    id: 'spine',
    category: 'Spine & Axial',
    icon: AlertTriangle,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
    borderColor: 'border-purple-200 hover:border-purple-400',
    topics: [
      { id: 'cervical', label: 'Cervical Spine (C1-C7)', description: 'Disc herniation, spinal stenosis' },
      { id: 'thoracic', label: 'Thoracic Spine (T1-T12)', description: 'Compression fractures, Scheuermann' },
      { id: 'lumbar', label: 'Lumbar Spine (L1-L5)', description: 'Disc disease, spondylolisthesis' },
      { id: 'sacrum', label: 'Sacrum & Coccyx', description: 'Sacral fractures, tailbone injury' },
      { id: 'pelvis', label: 'Pelvis & SI Joint', description: 'Pelvic ring injuries, sacroiliitis' },
      { id: 'disc', label: 'Intervertebral Disc', description: 'Disc degeneration, herniation' },
    ],
  },
  {
    id: 'pathology',
    category: 'Pathology',
    icon: Stethoscope,
    color: 'text-red-600',
    bgColor: 'bg-red-50 hover:bg-red-100',
    borderColor: 'border-red-200 hover:border-red-400',
    topics: [
      { id: 'bone-tumor-benign', label: 'Bone Tumors (Benign)', description: 'Osteochondroma, enchondroma' },
      { id: 'bone-tumor-malignant', label: 'Bone Tumors (Malignant)', description: 'Osteosarcoma, Ewing sarcoma' },
      { id: 'metabolic', label: 'Metabolic Bone Disease', description: 'Osteoporosis, Paget disease' },
      { id: 'infection', label: 'Infectious Bone Disease', description: 'Osteomyelitis, septic arthritis' },
      { id: 'vascular', label: 'Vascular Bone Disorders', description: 'Avascular necrosis, osteonecrosis' },
      { id: 'cyst', label: 'Bone Cysts & Lesions', description: 'Simple bone cyst, ABC' },
    ],
  },
  {
    id: 'trauma',
    category: 'Trauma & Fractures',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100',
    borderColor: 'border-orange-200 hover:border-orange-400',
    topics: [
      { id: 'long-bone-fx', label: 'Long Bone Fractures', description: 'Femur, tibia, humerus fractures' },
      { id: 'stress-fx', label: 'Stress Fractures', description: 'Fatigue fractures, insufficiency' },
      { id: 'compression-fx', label: 'Compression Fractures', description: 'Vertebral compression, calcaneal' },
      { id: 'pathologic-fx', label: 'Pathologic Fractures', description: 'Due to bone weakness, tumors' },
      { id: 'dislocation', label: 'Dislocations', description: 'Joint dislocations and reductions' },
      { id: 'growth-plate', label: 'Growth Plate Injuries', description: 'Salter-Harris fractures in kids' },
    ],
  },
  {
    id: 'degenerative',
    category: 'Degenerative',
    icon: HeartPulse,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 hover:bg-pink-100',
    borderColor: 'border-pink-200 hover:border-pink-400',
    topics: [
      { id: 'oa', label: 'Osteoarthritis', description: 'DJD, joint space narrowing' },
      { id: 'ddd', label: 'Degenerative Disc Disease', description: 'Disc dehydration, bulges' },
      { id: 'spondylosis', label: 'Spondylosis', description: 'Spinal osteoarthritis' },
      { id: 'spinal-stenosis', label: 'Spinal Stenosis', description: 'Canal narrowing, neurogenic claudication' },
      { id: 'avn', label: 'Avascular Necrosis', description: 'Osteonecrosis of bone' },
      { id: 'chondromalacia', label: 'Chondromalacia', description: 'Cartilage softening' },
    ],
  },
  {
    id: 'misc',
    category: 'Other Topics',
    icon: Brain,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 hover:bg-gray-100',
    borderColor: 'border-gray-200 hover:border-gray-400',
    topics: [
      { id: 'skull', label: 'Skull & Facial Bones', description: 'Cranium, mandible, maxilla fractures' },
      { id: 'ribs', label: 'Ribs & Sternum', description: 'Rib fractures, flail chest' },
      { id: 'pediatric', label: 'Pediatric Bones', description: 'Greenstick, torus fractures' },
      { id: 'congenital', label: 'Congenital Abnormalities', description: 'Developmental bone disorders' },
      { id: 'imaging', label: 'Imaging Techniques', description: 'X-ray, CT, MRI interpretation' },
      { id: 'surgical', label: 'Surgical Approaches', description: 'ORIF, arthroplasty, fusion' },
    ],
  },
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Array<{ documentTitle?: string; pageNumber?: string }>;
  createdAt: Date;
}

interface TopicChatContentProps {
  className?: string;
  embedded?: boolean;
}

export function TopicChatContent({ className = '', embedded = false }: TopicChatContentProps) {
  const searchParams = useSearchParams();
  const toast = useToast();
  const conversationRef = useRef<HTMLDivElement>(null);

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    searchParams.get('topicId')
  );
  const [selectedTopicLabel, setSelectedTopicLabel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTopicSelector, setShowTopicSelector] = useState(false);

  const currentTopic = topicCategories
    .flatMap((cat) => cat.topics)
    .find((t) => t.id === selectedTopicId);

  useEffect(() => {
    if (currentTopic) {
      setSelectedTopicLabel(currentTopic.label);
    }
  }, [currentTopic]);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelectTopic = (topic: Topic) => {
    setSelectedTopicId(topic.id);
    setSelectedTopicLabel(topic.label);
    setMessages([]);
    setShowTopicSelector(false);
    toast.success(`Đã chọn chủ đề: ${topic.label}`);
  };

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !selectedTopicId || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/student/visual-qa/ask-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionText: `[Topic: ${selectedTopicLabel}] ${inputMessage.trim()}`,
          topicId: selectedTopicId,
          sessionId: null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.latestTurn?.answerText || data.answerText || 'Xin lỗi, tôi không có câu trả lời.',
        citations: data.citations || data.latestTurn?.citations,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.',
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast.error('Không thể kết nối với AI. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, selectedTopicId, selectedTopicLabel, isLoading, toast]);

  const filteredCategories = topicCategories
    .map((cat) => ({
      ...cat,
      topics: cat.topics.filter(
        (t) =>
          t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((cat) => cat.topics.length > 0);

  if (!embedded) {
    return (
      <div className="min-h-screen">
        <StudentAppChrome
          breadcrumb="AI Assistant"
          title="AI Q&A by Topic"
          subtitle="Chat with AI using medical knowledge base"
        />
        <TopicChatInner
          selectedTopicId={selectedTopicId}
          selectedTopicLabel={selectedTopicLabel}
          messages={messages}
          inputMessage={inputMessage}
          isLoading={isLoading}
          showTopicSelector={showTopicSelector}
          searchQuery={searchQuery}
          filteredCategories={filteredCategories}
          conversationRef={conversationRef}
          onSelectTopic={handleSelectTopic}
          onSendMessage={handleSendMessage}
          onInputChange={setInputMessage}
          onToggleTopicSelector={() => setShowTopicSelector(!showTopicSelector)}
          onSearchChange={setSearchQuery}
          onClearChat={() => setMessages([])}
        />
      </div>
    );
  }

  return (
    <TopicChatInner
      selectedTopicId={selectedTopicId}
      selectedTopicLabel={selectedTopicLabel}
      messages={messages}
      inputMessage={inputMessage}
      isLoading={isLoading}
      showTopicSelector={showTopicSelector}
      searchQuery={searchQuery}
      filteredCategories={filteredCategories}
      conversationRef={conversationRef}
      onSelectTopic={handleSelectTopic}
      onSendMessage={handleSendMessage}
      onInputChange={setInputMessage}
      onToggleTopicSelector={() => setShowTopicSelector(!showTopicSelector)}
      onSearchChange={setSearchQuery}
      onClearChat={() => setMessages([])}
      className={className}
    />
  );
}

interface TopicChatInnerProps {
  selectedTopicId: string | null;
  selectedTopicLabel: string | null;
  messages: ChatMessage[];
  inputMessage: string;
  isLoading: boolean;
  showTopicSelector: boolean;
  searchQuery: string;
  filteredCategories: TopicCategory[];
  conversationRef: React.RefObject<HTMLDivElement | null>;
  onSelectTopic: (topic: Topic) => void;
  onSendMessage: () => void;
  onInputChange: (value: string) => void;
  onToggleTopicSelector: () => void;
  onSearchChange: (value: string) => void;
  onClearChat: () => void;
  className?: string;
}

function TopicChatInner({
  selectedTopicId,
  selectedTopicLabel,
  messages,
  inputMessage,
  isLoading,
  showTopicSelector,
  searchQuery,
  filteredCategories,
  conversationRef,
  onSelectTopic,
  onSendMessage,
  onInputChange,
  onToggleTopicSelector,
  onSearchChange,
  onClearChat,
  className = '',
}: TopicChatInnerProps) {
  const selectedTopicData = topicCategories.flatMap(cat => cat.topics).find(t => t.id === selectedTopicId);
  const selectedCategory = topicCategories.find(cat => cat.topics.some(t => t.id === selectedTopicId));

  if (!selectedTopicId) {
    return (
      <div className={cn('flex flex-col h-full overflow-hidden', className)}>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-4xl space-y-4">
            {/* Hero Banner - Premium */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 via-emerald-500 to-green-600 p-4 sm:p-5 text-white shadow-xl">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="font-['Manrope',sans-serif] text-base sm:text-lg font-bold text-white">
                      AI Q&A by Topic
                    </h2>
                    <p className="text-xs text-white/80 hidden sm:block">
                      Chat with AI about bone & joint anatomy
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-white/80" />
                  <span className="text-xs font-medium text-white/90">Powered by RAG</span>
                </div>
              </div>
            </div>

            {/* Topic Categories - Premium Cards */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border bg-gradient-to-r from-teal-50 to-emerald-50 px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                  <BookOpen className="h-4 w-4 text-teal-600" />
                  Select Bone & Joint Topic
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Choose a category to explore</p>
              </div>

              <div className="p-4 space-y-4">
                {/* Category Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {topicCategories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          const firstTopic = cat.topics[0];
                          onSelectTopic(firstTopic);
                        }}
                        className={`flex items-center gap-2 rounded-lg border p-2.5 transition-all ${cat.borderColor} ${cat.bgColor}`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm`}>
                          <Icon className={`h-4 w-4 ${cat.color}`} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-semibold text-card-foreground truncate">{cat.category}</p>
                          <p className="text-[10px] text-muted-foreground">{cat.topics.length} topics</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* All Topics Grid - Grouped by Category */}
                <div className="space-y-3">
                  {topicCategories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <div key={cat.id} className={`rounded-lg border ${cat.borderColor.split('hover:')[0]} ${cat.bgColor.split('hover:')[0]} p-3`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className={`h-4 w-4 ${cat.color}`} />
                          <p className={`text-xs font-semibold ${cat.color}`}>{cat.category}</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {cat.topics.map((topic) => (
                            <button
                              key={topic.id}
                              onClick={() => onSelectTopic(topic)}
                              className="rounded-md border border-white/50 bg-white/80 px-2.5 py-2 text-left text-xs font-medium text-gray-700 shadow-sm transition-all hover:shadow-md hover:scale-[1.02]"
                            >
                              {topic.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Topic Header - Premium */}
      <div className="shrink-0 border-b border-border bg-gradient-to-r from-teal-50 to-emerald-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectTopic({ id: '', label: '', description: '' } as Topic)}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {selectedCategory && (
              <>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${selectedCategory.bgColor}`}>
                  <selectedCategory.icon className={`h-4 w-4 ${selectedCategory.color}`} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{selectedCategory.category}</p>
                  <p className="font-semibold text-card-foreground text-sm">{selectedTopicLabel}</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearChat}
                className="text-xs h-8"
              >
                Clear
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleTopicSelector}
              className="gap-1 h-8"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Change</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Topic Selector Dropdown */}
        {showTopicSelector && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-white border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {filteredCategories.map((cat) => {
                const CatIcon = cat.icon;
                return (
                  <div key={cat.id}>
                    <p className={`text-xs font-semibold ${cat.color} mb-1 flex items-center gap-1`}>
                      <CatIcon className="h-3 w-3" />
                      {cat.category}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {cat.topics.map((topic) => (
                        <button
                          key={topic.id}
                          onClick={() => onSelectTopic(topic)}
                          className={cn(
                            'rounded px-2 py-1.5 text-left text-xs transition-all',
                            topic.id === selectedTopicId
                              ? 'bg-teal-500 text-white shadow-sm'
                              : 'bg-white hover:bg-teal-50 text-muted-foreground hover:text-teal-600 border border-border'
                          )}
                        >
                          {topic.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Welcome Message - Premium */}
      {messages.length === 0 && (
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 shadow-lg">
              <Sparkles className="h-7 w-7 text-teal-600" />
            </div>
            <h3 className="text-base font-bold text-card-foreground mb-1">
              Ask about {selectedTopicLabel}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {selectedTopicData?.description || 'Learn more about this topic'}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {['Diagnosis', 'Symptoms', 'Treatment', 'Imaging'].map((q) => (
                <button
                  key={q}
                  onClick={() => onInputChange(`Tell me about ${q.toLowerCase()} related to ${selectedTopicLabel}`)}
                  className="rounded-full bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages - Premium */}
      <div
        ref={conversationRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 bg-gradient-to-b from-white to-teal-50/30"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-2',
              message.role === 'user' && 'flex-row-reverse'
            )}
          >
            <div
              className={cn(
                'flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-xs',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : message.role === 'system'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-teal-100 text-teal-600'
              )}
            >
              {message.role === 'user' ? 'U' : message.role === 'system' ? '!' : <Bot className="h-3.5 w-3.5" />}
            </div>
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-xs sm:text-sm',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : message.role === 'system'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 rounded-tl-sm'
                  : 'bg-card border border-border rounded-tl-sm'
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              {message.citations && message.citations.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-border/50">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Nguồn:</p>
                  <ul className="space-y-0.5">
                    {message.citations.map((citation, idx) => (
                      <li key={idx} className="text-[10px] text-muted-foreground">
                        📖 {citation.documentTitle} {citation.pageNumber ? `(Tr.${citation.pageNumber})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                {message.createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="bg-card border border-border rounded-xl rounded-tl-sm px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600" style={{ animationDelay: '0ms' }} />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600" style={{ animationDelay: '150ms' }} />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input - Compact */}
      <div className="shrink-0 border-t border-border bg-card p-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            placeholder={`Hỏi về ${selectedTopicLabel}...`}
            disabled={isLoading}
            className="flex-1 h-9 px-3 rounded-lg bg-background border border-border text-xs sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <Button
            onClick={onSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            size="sm"
            className="gap-1 h-9 px-3 bg-teal-600 hover:bg-teal-700"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Gửi</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
