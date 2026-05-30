'use client';

import React, { useState, useEffect } from 'react';
import { Target, Plus, Trash2, Check, X, ChevronDown, ChevronUp, Loader2, AlertCircle, Edit2 } from 'lucide-react';
import {
  fetchTeachingObjectives,
  updateTeachingObjectives,
  fetchExpertSuggestions,
  confirmSuggestion,
  type TeachingObjectivesDto,
  type TeachingObjectiveSuggestionDto,
  type TeachingObjectiveItem,
  type UpdateTeachingObjectivesRequestDto,
} from '@/lib/api/lecturer-dashboard';

interface TeachingObjectivesProps {
  classId?: string;
  onError?: (error: string) => void;
}

export default function TeachingObjectives({ classId, onError }: TeachingObjectivesProps) {
  const [objectives, setObjectives] = useState<TeachingObjectivesDto | null>(null);
  const [suggestions, setSuggestions] = useState<TeachingObjectiveSuggestionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'objectives' | 'suggestions'>('objectives');
  const [isEditing, setIsEditing] = useState(false);
  const [editedObjectives, setEditedObjectives] = useState<TeachingObjectiveItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [confirmingSuggestion, setConfirmingSuggestion] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [classId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const objData = await fetchTeachingObjectives(classId);
      setObjectives(objData);
      setEditedObjectives(objData.objectives);
      if (classId) {
        const sugData = await fetchExpertSuggestions(classId);
        setSuggestions(sugData);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to load teaching objectives');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!objectives) return;
    setSaving(true);
    try {
      const request: UpdateTeachingObjectivesRequestDto = {
        objectives: editedObjectives,
        replaceAll: false,
      };
      const updated = await updateTeachingObjectives(objectives.classId, request);
      setObjectives(updated);
      setIsEditing(false);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to save objectives');
    } finally {
      setSaving(false);
    }
  };

  const handleAddObjective = () => {
    setEditedObjectives([
      ...editedObjectives,
      {
        id: crypto.randomUUID(),
        topic: '',
        objective: '',
        level: 'Basic',
        order: editedObjectives.length,
        isActive: true,
      },
    ]);
    setIsEditing(true);
  };

  const handleDeleteObjective = (id: string) => {
    setEditedObjectives(editedObjectives.filter((o) => o.id !== id));
  };

  const handleUpdateObjective = (id: string, field: keyof TeachingObjectiveItem, value: string | boolean | number) => {
    setEditedObjectives(
      editedObjectives.map((o) =>
        o.id === id ? { ...o, [field]: value } : o
      )
    );
  };

  const handleApproveSuggestion = async (suggestion: TeachingObjectiveSuggestionDto) => {
    if (!objectives) return;
    setConfirmingSuggestion(suggestion.id);
    try {
      await confirmSuggestion(objectives.classId, suggestion.id, {
        suggestionId: suggestion.id,
        approve: true,
      });
      await loadData();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to approve suggestion');
    } finally {
      setConfirmingSuggestion(null);
    }
  };

  const handleRejectSuggestion = async (suggestion: TeachingObjectiveSuggestionDto) => {
    if (!objectives || !rejectReason.trim()) return;
    setConfirmingSuggestion(suggestion.id);
    try {
      await confirmSuggestion(objectives.classId, suggestion.id, {
        suggestionId: suggestion.id,
        approve: false,
        rejectionReason: rejectReason,
      });
      setShowRejectInput(null);
      setRejectReason('');
      await loadData();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to reject suggestion');
    } finally {
      setConfirmingSuggestion(null);
    }
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === 'Pending');
  const levelColors: Record<string, string> = {
    Basic: 'bg-green-100 text-green-800',
    Intermediate: 'bg-yellow-100 text-yellow-800',
    Advanced: 'bg-red-100 text-red-800',
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-card-foreground">Teaching Objectives</h3>
            <p className="text-sm text-muted-foreground">
              {objectives?.totalObjectives ?? 0} objectives • {pendingSuggestions.length} pending suggestions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {objectives?.expertName && (
            <span className="text-xs text-muted-foreground">
              Expert: {objectives.expertName}
            </span>
          )}
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('objectives')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'objectives'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Objectives ({objectives?.objectives.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${
                activeTab === 'suggestions'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Expert Suggestions ({pendingSuggestions.length})
              {pendingSuggestions.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                  {pendingSuggestions.length}
                </span>
              )}
            </button>
          </div>

          <div className="p-4">
            {/* Objectives Tab */}
            {activeTab === 'objectives' && (
              <div className="space-y-3">
                {editedObjectives.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No teaching objectives yet</p>
                    <button
                      onClick={handleAddObjective}
                      className="mt-3 text-sm text-primary hover:underline"
                    >
                      Add first objective
                    </button>
                  </div>
                ) : (
                  <>
                    {editedObjectives.map((obj, idx) => (
                      <div
                        key={obj.id}
                        className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <span className="text-sm font-medium text-muted-foreground w-6">
                              {idx + 1}.
                            </span>
                            <div className="flex-1">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Topic"
                                    value={obj.topic}
                                    onChange={(e) => handleUpdateObjective(obj.id, 'topic', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                  />
                                  <textarea
                                    placeholder="Objective description"
                                    value={obj.objective}
                                    onChange={(e) => handleUpdateObjective(obj.id, 'objective', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                    rows={2}
                                  />
                                  <select
                                    value={obj.level}
                                    onChange={(e) => handleUpdateObjective(obj.id, 'level', e.target.value)}
                                    className="px-3 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                  >
                                    <option value="Basic">Basic</option>
                                    <option value="Intermediate">Intermediate</option>
                                    <option value="Advanced">Advanced</option>
                                  </select>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-card-foreground">{obj.topic}</span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${levelColors[obj.level] || ''}`}>
                                      {obj.level}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{obj.objective}</p>
                                </>
                              )}
                            </div>
                          </div>
                          {isEditing && (
                            <button
                              onClick={() => handleDeleteObjective(obj.id)}
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors ml-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center gap-3 pt-3">
                      {isEditing ? (
                        <>
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(false);
                              setEditedObjectives(objectives?.objectives ?? []);
                            }}
                            className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleAddObjective}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Add Objective
                          </button>
                          <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Suggestions Tab */}
            {activeTab === 'suggestions' && (
              <div className="space-y-3">
                {pendingSuggestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No pending suggestions from experts</p>
                  </div>
                ) : (
                  pendingSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="p-4 rounded-lg border border-warning/50 bg-warning/10"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-card-foreground">{suggestion.topic}</span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${levelColors[suggestion.level] || ''}`}>
                              {suggestion.level}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            From: {suggestion.expertName || 'Expert'}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-card-foreground mb-4">{suggestion.objective}</p>

                      {showRejectInput === suggestion.id ? (
                        <div className="space-y-2">
                          <textarea
                            placeholder="Reason for rejection..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background resize-none"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRejectSuggestion(suggestion)}
                              disabled={!rejectReason.trim() || confirmingSuggestion === suggestion.id}
                              className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md text-sm hover:bg-destructive/90 transition-colors disabled:opacity-50"
                            >
                              Confirm Reject
                            </button>
                            <button
                              onClick={() => {
                                setShowRejectInput(null);
                                setRejectReason('');
                              }}
                              className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveSuggestion(suggestion)}
                            disabled={confirmingSuggestion === suggestion.id}
                            className="flex items-center gap-2 px-4 py-2 bg-success text-success-foreground rounded-md text-sm hover:bg-success/90 transition-colors disabled:opacity-50"
                          >
                            {confirmingSuggestion === suggestion.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => setShowRejectInput(suggestion.id)}
                            className="flex items-center gap-2 px-4 py-2 border border-destructive text-destructive rounded-md text-sm hover:bg-destructive/10 transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
