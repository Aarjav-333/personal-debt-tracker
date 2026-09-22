/**
 * Supabase schema types.
 *
 * Kept in sync by hand with `supabase/migrations/*.sql`. To regenerate from a
 * live project instead:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/types/database.ts
 *
 * NUMERIC columns arrive from PostgREST as JSON numbers; every amount is run
 * through `toMinor()` (see `src/lib/money.ts`) before any arithmetic happens.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          currency?: string;
        };
        Update: {
          email?: string;
          display_name?: string | null;
          currency?: string;
        };
        Relationships: [];
      };
      borrowers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          phone: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          phone?: string | null;
          notes?: string | null;
        };
        Update: {
          name?: string;
          phone?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      debts: {
        Row: {
          id: string;
          user_id: string;
          borrower_id: string;
          original_amount: number;
          reason: string | null;
          borrowed_date: string;
          expected_return_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          borrower_id: string;
          /** Sent as a fixed-2dp string so the value never touches a float on the wire. */
          original_amount: string;
          reason?: string | null;
          borrowed_date: string;
          expected_return_date?: string | null;
          notes?: string | null;
        };
        Update: {
          borrower_id?: string;
          original_amount?: string;
          reason?: string | null;
          borrowed_date?: string;
          expected_return_date?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      repayments: {
        Row: {
          id: string;
          user_id: string;
          debt_id: string;
          borrower_id: string;
          amount: number;
          repayment_date: string;
          method: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          debt_id: string;
          /** Derived from the debt by a BEFORE trigger; sent only to satisfy NOT NULL. */
          borrower_id: string;
          amount: string;
          repayment_date: string;
          method?: string | null;
          notes?: string | null;
        };
        Update: {
          amount?: string;
          repayment_date?: string;
          method?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      debt_balances: {
        Row: {
          id: string;
          user_id: string;
          borrower_id: string;
          borrower_name: string;
          borrower_phone: string | null;
          original_amount: number;
          reason: string | null;
          borrowed_date: string;
          expected_return_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          total_repaid: number;
          outstanding: number;
          repayment_count: number;
          last_repayment_date: string | null;
        };
        Relationships: [];
      };
      borrower_balances: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          phone: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          debt_count: number;
          total_borrowed: number;
          total_repaid: number;
          outstanding: number;
        };
        Relationships: [];
      };
      activity_feed: {
        Row: {
          id: string;
          kind: "borrow" | "repayment";
          user_id: string;
          borrower_id: string;
          borrower_name: string;
          debt_id: string;
          amount: number;
          event_date: string;
          detail: string | null;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      settle_debt: {
        Args: {
          p_debt_id: string;
          p_repayment_date?: string | null;
          p_method?: string | null;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["repayments"]["Row"];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];

export type BorrowerRow = Tables<"borrowers">;
export type DebtRow = Tables<"debts">;
export type RepaymentRow = Tables<"repayments">;
export type ProfileRow = Tables<"profiles">;

export type DebtBalanceRow = Views<"debt_balances">;
export type BorrowerBalanceRow = Views<"borrower_balances">;
export type ActivityRow = Views<"activity_feed">;
