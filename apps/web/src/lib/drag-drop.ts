"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface DragDropSortableOptions<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (newItems: T[]) => void;
  disabled?: boolean;
}

export interface DragDropSortableResult<T> {
  items: T[];
  draggedIndex: number | null;
  dragOverIndex: number | null;
  handleDragStart: (index: number, e: React.DragEvent) => void;
  handleDragOver: (index: number, e: React.DragEvent) => void;
  handleDragLeave: (index: number, e: React.DragEvent) => void;
  handleDragEnd: (index: number, e: React.DragEvent) => void;
  handleDrop: (index: number, e: React.DragEvent) => void;
  handleKeyDown: (index: number, e: React.KeyboardEvent) => void;
}

/**
 * Hook for making a list sortable via drag-and-drop (HTML5 native API).
 * Also supports keyboard reordering with Ctrl+Up/Down.
 */
export function useDragDropSortable<T>({
  items,
  getId,
  onReorder,
  disabled = false,
}: DragDropSortableOptions<T>): DragDropSortableResult<T> {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const itemsRef = useRef(items);
  const draggedItemRef = useRef<T | null>(null);

  // Keep itemsRef in sync
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const handleDragStart = useCallback((index: number, e: React.DragEvent) => {
    if (disabled) return;
    setDraggedIndex(index);
    draggedItemRef.current = items[index];
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", getId(items[index]));
  }, [disabled, getId, items]);

  const handleDragOver = useCallback((index: number, e: React.DragEvent) => {
    if (disabled || draggedIndex === null || draggedIndex === index) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, [disabled, draggedIndex]);

  const handleDragLeave = useCallback((_index: number, e: React.DragEvent) => {
    if (disabled) return;
    // Only clear if we're actually leaving the element (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIndex(null);
    }
  }, [disabled]);

  const handleDragEnd = useCallback((_index: number, _e: React.DragEvent) => {
    if (disabled) return;
    setDraggedIndex(null);
    setDragOverIndex(null);
    draggedItemRef.current = null;
  }, [disabled]);

  const handleDrop = useCallback((targetIndex: number, e: React.DragEvent) => {
    if (disabled || draggedIndex === null || draggedIndex === targetIndex) return;
    e.preventDefault();
    setDragOverIndex(null);
    const newItems = [...itemsRef.current];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, removed);
    onReorder(newItems);
    setDraggedIndex(null);
    draggedItemRef.current = null;
  }, [disabled, draggedIndex, onReorder]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (disabled || !e.ctrlKey && !e.metaKey) return;
    if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      const newItems = [...itemsRef.current];
      const [removed] = newItems.splice(index, 1);
      newItems.splice(index - 1, 0, removed);
      onReorder(newItems);
    } else if (e.key === "ArrowDown" && index < itemsRef.current.length - 1) {
      e.preventDefault();
      const newItems = [...itemsRef.current];
      const [removed] = newItems.splice(index, 1);
      newItems.splice(index + 1, 0, removed);
      onReorder(newItems);
    }
  }, [disabled, onReorder]);

  return {
    items,
    draggedIndex,
    dragOverIndex,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
    handleDrop,
    handleKeyDown,
  };
}