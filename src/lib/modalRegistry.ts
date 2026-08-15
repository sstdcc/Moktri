// Central registry for modal layers (Dialog / AlertDialog / Sheet).
// Used by the Android back-button handler so that pressing Back with an
// open layer closes the topmost layer instead of navigating / exiting.
// Layers are stored as a LIFO stack; each layer registers a close() that
// triggers the Radix onOpenChange(false) path (same as the X / overlay click).

import { useEffect, useRef, useState } from 'react';

type ModalLayer = {
  id: number;
  close: () => void;
};

let nextId = 1;
const layers: ModalLayer[] = [];

export const registerModalLayer = (close: () => void): (() => void) => {
  const id = nextId++;
  layers.push({ id, close });
  return () => {
    const index = layers.findIndex((layer) => layer.id === id);
    if (index !== -1) layers.splice(index, 1);
  };
};

export const hasOpenModalLayer = (): boolean => layers.length > 0;

export const closeTopModalLayer = (): boolean => {
  const layer = layers[layers.length - 1];
  if (!layer) return false;
  // Pop immediately so rapid double-taps cannot close the same layer twice.
  layers.splice(layers.length - 1, 1);
  layer.close();
  return true;
};

interface LayerControlOptions {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Bridges a Radix modal root (Dialog / AlertDialog / Sheet) with the central
 * registry. Works for both controlled (`open` provided) and uncontrolled
 * (`defaultOpen` / trigger) usages:
 *  - it derives the effective open state and forwards onOpenChange unchanged,
 *  - while `open === true` it registers a layer whose close() follows the same
 *    path as the X button / overlay click (calls onOpenChange(false) when
 *    controlled, or flips the internal state when uncontrolled).
 *
 * Returns props to be spread onto the Radix Root.
 */
export const useModalLayer = (options: LayerControlOptions) => {
  const { open: openProp, defaultOpen = false, onOpenChange } = options;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const [internalOpen, setInternalOpen] = useState(() => openProp ?? defaultOpen);

  // Keep the internal mirror in sync when the consumer controls `open`.
  useEffect(() => {
    if (openProp !== undefined) setInternalOpen(openProp);
  }, [openProp]);

  const isOpen = openProp ?? internalOpen;

  useEffect(() => {
    if (!isOpen) return;
    return registerModalLayer(() => {
      onOpenChangeRef.current?.(false);
      if (openProp === undefined) setInternalOpen(false);
    });
  }, [isOpen, openProp]);

  const handleOpenChange = (next: boolean) => {
    onOpenChangeRef.current?.(next);
    if (openProp === undefined) setInternalOpen(next);
  };

  return { open: isOpen, onOpenChange: handleOpenChange };
};