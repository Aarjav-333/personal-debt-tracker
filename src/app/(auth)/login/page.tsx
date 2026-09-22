import type { Metadata } from "next";

import { AuthForm } from "@/components/app/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return <AuthForm mode="signin" next={next} initialError={error} />;
}
