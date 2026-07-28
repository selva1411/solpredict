"use client";

import { ErrorPage } from "@/components/ErrorPage";

export default function ProfileError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPage error={error} reset={reset} title="Profile Error" />;
}
