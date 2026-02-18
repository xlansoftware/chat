"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";

interface PromptDialogProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  placeholder?: string;
  initialValue?: string;
  inputLabel?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  isOpen,
  title = "Enter Value",
  description = "Please provide the requested information.",
  placeholder = "Enter here...",
  initialValue = "",
  inputLabel = "",
  confirmText = "Submit",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        setValue(initialValue ?? "");
      })
    }
  }, [isOpen, setValue, initialValue]);

  const handleConfirm = () => {
    onConfirm(value);
    setValue("");
  };

  const handleCancel = () => {
    setValue("");
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-0">
          <div className="grid grid-cols-4 items-center gap-4">
            {inputLabel && <Label htmlFor="global-prompt" className="text-right">
              {inputLabel}
            </Label>}
            <Input
              id="global-prompt"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="col-span-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && value.trim()) {
                  handleConfirm();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {cancelText}
          </Button>
          <Button onClick={handleConfirm} disabled={!value.trim()}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}