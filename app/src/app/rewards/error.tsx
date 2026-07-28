"use client";

import { ErrorPage } from "@/components/ErrorPage";

export default function RewardsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPage error={error} reset={reset} title="Rewards Error" />;
}
