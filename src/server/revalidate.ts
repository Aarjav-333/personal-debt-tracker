import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Financial data appears on several screens at once (dashboard totals, the
 * borrowers list, a borrower's page, a debt's page, the activity ledger), so
 * every mutation revalidates the whole authenticated layout.
 *
 * Cheap for a personal ledger, and it removes any chance of one screen showing
 * a balance that another screen has already moved past.
 */
export function revalidateLedger() {
  revalidatePath("/", "layout");
}
