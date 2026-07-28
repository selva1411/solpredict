"use client";

import { ErrorPage } from "@/components/ErrorPage";

export default function CreateError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPage error={error} reset={reset} title="Market Creation Error" />;
}
