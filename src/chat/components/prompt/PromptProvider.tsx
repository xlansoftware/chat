"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { PromptDialog } from "./PromptDialog";

interface PromptOptions {
  title?: string;
  description?: string;
  placeholder?: string;
  initialValue?: string;
  inputLabel?: string;
  confirmText?: string;
  cancelText?: string;
  validator?: (value: string) => boolean | string;
}

interface PromptContextType {
  prompt: (options?: PromptOptions) => Promise<string | null>;
}

const PromptContext = createContext<PromptContextType | undefined>(undefined);

export function PromptProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<PromptOptions>({});
  const [resolver, setResolver] = useState<((value: string | null) => void) | null>(null);

  const prompt = (opts: PromptOptions = {}) => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise<string | null>((resolve) => {
      setResolver(() => resolve);
    });
  };

  const handleConfirm = (value: string) => {
    setIsOpen(false);
    resolver?.(value);
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolver?.(null);
  };

  return (
    <PromptContext.Provider value={{ prompt }}>
      {children}
      <PromptDialog
        isOpen={isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={options.title}
        description={options.description}
        placeholder={options.placeholder}
        initialValue={options.initialValue}
        inputLabel={options.inputLabel}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
      />
    </PromptContext.Provider>
  );
}

export function usePrompt() {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error("usePrompt must be used within a PromptProvider");
  }
  return context.prompt;
}