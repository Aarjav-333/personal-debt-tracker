import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="pt-safe pb-safe flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="bg-muted text-muted-foreground mb-5 flex size-14 items-center justify-center rounded-full">
        <FileQuestion className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-muted-foreground mt-2 max-w-xs text-sm text-balance">
        This borrower or debt no longer exists &mdash; it may have been deleted.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to overview</Link>
      </Button>
    </div>
  );
}
