"use client";

import { ErrorPage } from "@/components/ErrorPage";

export default function MarketsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPage error={error} reset={reset} title="Markets Feed Error" />;
}
