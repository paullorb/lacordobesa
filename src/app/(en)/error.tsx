"use client";

import { ErrorView } from "@/components/pages/error-view";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView locale="en" error={error} retry={retry} />;
}
