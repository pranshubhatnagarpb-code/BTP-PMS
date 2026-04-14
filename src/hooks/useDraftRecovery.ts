import { useState, useEffect, useCallback } from 'react';

export interface DraftData {
  id: string;
  type: 'template' | 'diet-plan';
  data: any;
  createdAt: number;
  lastModified: number;
}

const DRAFT_STORAGE_KEY = 'nhz_drafts';

export const useDraftRecovery = (type: 'template' | 'diet-plan') => {
  const [drafts, setDrafts] = useState<DraftData[]>([]);

  // Load drafts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const parsedDrafts = JSON.parse(stored);
        setDrafts(parsedDrafts.filter((d: DraftData) => d.type === type));
      }
    } catch (error) {
      console.error('Error loading drafts:', error);
    }
  }, [type]);

  // Save draft to localStorage
  const saveDraft = useCallback((id: string, data: any) => {
    try {
      const now = Date.now();
      const newDraft: DraftData = {
        id,
        type,
        data,
        createdAt: now,
        lastModified: now
      };

      // Update drafts in state
      setDrafts(prev => {
        const filtered = prev.filter(d => d.id !== id);
        return [...filtered, newDraft];
      });

      // Update localStorage
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      const allDrafts = stored ? JSON.parse(stored) : [];
      const filteredAll = allDrafts.filter((d: DraftData) => d.id !== id && d.type !== type);
      const updatedDrafts = [...filteredAll, newDraft];
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(updatedDrafts));

      console.log(`Draft saved for ${type} ${id}`);
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [type]);

  // Get specific draft
  const getDraft = useCallback((id: string): DraftData | null => {
    return drafts.find(d => d.id === id) || null;
  }, [drafts]);

  // Clear specific draft
  const clearDraft = useCallback((id: string) => {
    try {
      // Update state
      setDrafts(prev => prev.filter(d => d.id !== id));

      // Update localStorage
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const allDrafts = JSON.parse(stored);
        const filtered = allDrafts.filter((d: DraftData) => d.id !== id);
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(filtered));
      }

      console.log(`Draft cleared for ${type} ${id}`);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [type]);

  // Clear all drafts for this type
  const clearAllDrafts = useCallback(() => {
    try {
      // Update state
      setDrafts([]);

      // Update localStorage
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const allDrafts = JSON.parse(stored);
        const filtered = allDrafts.filter((d: DraftData) => d.type !== type);
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(filtered));
      }

      console.log(`All drafts cleared for ${type}`);
    } catch (error) {
      console.error('Error clearing all drafts:', error);
    }
  }, [type]);

  // Check if draft exists
  const hasDraft = useCallback((id: string): boolean => {
    return drafts.some(d => d.id === id);
  }, [drafts]);

  return {
    drafts,
    saveDraft,
    getDraft,
    clearDraft,
    clearAllDrafts,
    hasDraft
  };
};

// Utility function to save draft on save failure
export const saveWithDraftFallback = async (
  saveFn: Function,
  data: any,
  draftId: string,
  type: 'template' | 'diet-plan'
) => {
  try {
    await saveFn(data);
    // Clear draft on successful save
    const stored = localStorage.getItem('nhz_drafts');
    if (stored) {
      const allDrafts = JSON.parse(stored);
      const filtered = allDrafts.filter((d: DraftData) => d.id !== draftId);
      localStorage.setItem('nhz_drafts', JSON.stringify(filtered));
    }
    return { success: true };
  } catch (error) {
    // Save draft on failure
    const now = Date.now();
    const draft: DraftData = {
      id: draftId,
      type,
      data,
      createdAt: now,
      lastModified: now
    };

    const stored = localStorage.getItem('nhz_drafts');
    const allDrafts = stored ? JSON.parse(stored) : [];
    const filtered = allDrafts.filter((d: DraftData) => d.id !== draftId);
    const updatedDrafts = [...filtered, draft];
    localStorage.setItem('nhz_drafts', JSON.stringify(updatedDrafts));

    console.log(`Draft saved due to save failure for ${type} ${draftId}`);
    throw error;
  }
};
