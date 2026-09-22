"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";

/** Retries whatever failed. Disabled while the device is still offline. */
export function RetryButton({
  className,
  label = "Try again",
  onRetry,
}: {
  className?: string;
  label?: string;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          if (onRetry) onRetry();
          else router.refresh();
        })
      }
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
      {online ? label : "Waiting for a connection"}
    </Button>
  );
}
