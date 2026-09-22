"use client";

import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Amount } from "@/components/app/amount";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { runAction } from "@/lib/client-actions";
import { borrowerInputSchema, fieldErrorsFrom } from "@/lib/validators";
import { deleteBorrower, updateBorrower } from "@/server/actions/borrowers";

interface BorrowerActionsProps {
  borrower: { id: string; name: string; phone: string | null; notes: string | null };
  totals: { debtCount: number; repaymentCount: number; outstandingMinor: number };
}

/** Edit and delete for a borrower, kept behind a menu so the page stays calm. */
export function BorrowerActions({ borrower, totals }: BorrowerActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${borrower.name}`}>
            <MoreHorizontal className="size-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        {/* Both dialogs live outside the menu: Radix unmounts menu contents on
            close, which would tear down a dialog rendered inside it. */}
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden />
            Edit borrower
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 className="size-4" aria-hidden />
            Delete borrower
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditBorrowerDrawer borrower={borrower} open={editing} onOpenChange={setEditing} />

      <ConfirmDialog
        destructive
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${borrower.name}?`}
        confirmLabel="Delete everything"
        description={
          <>
            <p>
              This will permanently delete this borrower and all associated debt and repayment
              history.
            </p>
            <p className="text-muted-foreground">
              {totals.debtCount} borrowing{totals.debtCount === 1 ? "" : "s"} and{" "}
              {totals.repaymentCount} repayment{totals.repaymentCount === 1 ? "" : "s"} will be
              removed
              {totals.outstandingMinor > 0 ? (
                <>
                  , including <Amount minor={totals.outstandingMinor} /> still outstanding
                </>
              ) : null}
              . This cannot be undone.
            </p>
          </>
        }
        onConfirm={async () => {
          const result = await runAction(() => deleteBorrower(borrower.id), {
            success: `${borrower.name} deleted`,
          });
          if (result?.ok) {
            router.replace("/borrowers");
            router.refresh();
          }
          return result;
        }}
      />
    </>
  );
}

function EditBorrowerDrawer({
  borrower,
  open,
  onOpenChange,
}: {
  borrower: { id: string; name: string; phone: string | null; notes: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(borrower.name);
  const [phone, setPhone] = useState(borrower.phone ?? "");
  const [notes, setNotes] = useState(borrower.notes ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = { name, phone, notes };
    const parsed = borrowerInputSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = await runAction(() => updateBorrower({ id: borrower.id, ...payload }), {
        success: "Borrower updated",
      });
      if (result?.ok) onOpenChange(false);
      else if (result && !result.ok) setFieldErrors(result.fieldErrors ?? {});
    });
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DrawerContent className="mx-auto max-w-lg">
        <form onSubmit={submit} noValidate className="overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Edit borrower</DrawerTitle>
            <DrawerDescription>Their debts and repayments are not affected.</DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-borrower-name">Name</Label>
              <Input
                id="edit-borrower-name"
                value={name}
                maxLength={120}
                autoCapitalize="words"
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name ? <p className="text-destructive text-sm">{fieldErrors.name}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-borrower-phone">Phone number</Label>
              <Input
                id="edit-borrower-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                placeholder="+91 98765 43210"
                onChange={(event) => setPhone(event.target.value)}
                aria-invalid={Boolean(fieldErrors.phone)}
              />
              {fieldErrors.phone ? <p className="text-destructive text-sm">{fieldErrors.phone}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-borrower-notes">Notes</Label>
              <Textarea
                id="edit-borrower-notes"
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>

          <DrawerFooter>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save changes
            </Button>
            <DrawerClose asChild>
              <Button type="button" size="lg" variant="ghost">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
