"use client";

import { cn } from "cn";
import { Check, Search, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PickableBorrower {
  id: string;
  name: string;
  phone: string | null;
}

interface BorrowerPickerProps {
  borrowers: PickableBorrower[];
  selectedId: string | null;
  /** Free-typed name, used when no existing borrower is selected. */
  name: string;
  onSelect: (borrower: PickableBorrower | null) => void;
  onNameChange: (name: string) => void;
  error?: string;
}

/**
 * One field that both finds an existing borrower and names a new one.
 *
 * Lending to the same person twice must never create a second borrower, so
 * matches are surfaced as you type and an exact name match is called out
 * before you can accidentally duplicate it.
 */
export function BorrowerPicker({
  borrowers,
  selectedId,
  name,
  onSelect,
  onNameChange,
  error,
}: BorrowerPickerProps) {
  const [touched, setTouched] = useState(false);
  const selected = borrowers.find((borrower) => borrower.id === selectedId) ?? null;

  const query = name.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!query) return borrowers.slice(0, 6);
    return borrowers.filter((borrower) => borrower.name.toLowerCase().includes(query)).slice(0, 6);
  }, [borrowers, query]);

  const exactMatch = borrowers.find((borrower) => borrower.name.trim().toLowerCase() === query);
  const showSuggestions = touched && !selected && matches.length > 0;

  if (selected) {
    return (
      <div className="space-y-1.5">
        <Label>Borrower</Label>
        <div className="border-border bg-muted/40 flex items-center gap-2 rounded-lg border px-3 py-2.5">
          <Check className="text-money-positive size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{selected.name}</span>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              onNameChange("");
              setTouched(true);
            }}
            className="text-muted-foreground hover:text-foreground tap-transparent inline-flex items-center gap-1 text-xs font-medium"
          >
            <X className="size-3.5" aria-hidden />
            Change
          </button>
        </div>
        <p className="text-muted-foreground text-xs">
          This borrowing will be added to {selected.name}&rsquo;s existing record.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="borrower-name">Borrower</Label>
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
        <Input
          id="borrower-name"
          className="pl-9"
          autoComplete="off"
          autoCapitalize="words"
          placeholder="Search or type a new name"
          value={name}
          onFocus={() => setTouched(true)}
          onChange={(event) => onNameChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "borrower-name-error" : undefined}
        />
      </div>

      {showSuggestions ? (
        <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-lg border">
          {matches.map((borrower) => (
            <li key={borrower.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(borrower);
                  onNameChange(borrower.name);
                }}
                className="tap-transparent hover:bg-muted/60 flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors"
              >
                <span className="truncate font-medium">{borrower.name}</span>
                {borrower.phone ? (
                  <span className="text-muted-foreground shrink-0 text-xs">{borrower.phone}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {query && !exactMatch ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <UserPlus className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            &ldquo;{name.trim()}&rdquo; will be added as a new borrower.
          </span>
        </p>
      ) : null}

      {query && exactMatch ? (
        <p className="text-money-warning text-xs">
          You already have a borrower named {exactMatch.name}.{" "}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => {
              onSelect(exactMatch);
              onNameChange(exactMatch.name);
            }}
          >
            Add to their record instead
          </button>
          .
        </p>
      ) : null}

      {error ? (
        <p id="borrower-name-error" className={cn("text-destructive text-sm")}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
