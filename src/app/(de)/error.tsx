"use client";

import { ErrorView } from "@/components/pages/error-view";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView locale="de" error={error} reset={reset} />;
}
