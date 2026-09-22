"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { guardOnline } from "@/lib/client-actions";

interface ConfirmDialogProps {
  /** Omit when driving the dialog from a menu item via `open`/`onOpenChange`. */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  /** Spell out the consequence in money terms - never just "are you sure?". */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown>;
}

/**
 * Explicit confirmation for anything that changes or removes a financial
 * record. The dialog stays open while the action runs and only closes once it
 * has actually succeeded, so a failure is never mistaken for a success.
 */
export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (pending) return;
    if (isControlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  }

  function handleConfirm(event: React.MouseEvent) {
    // Radix closes on click by default; hold it open until the write lands.
    event.preventDefault();
    if (!guardOnline()) return;

    startTransition(async () => {
      const result = (await onConfirm()) as { ok?: boolean } | null | undefined;
      if (result && result.ok === false) return;
      if (isControlled) onOpenChange?.(false);
      else setUncontrolledOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
