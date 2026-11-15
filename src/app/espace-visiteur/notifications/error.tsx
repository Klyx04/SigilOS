"use client";

import { VisitorError } from "../_components/visitor-error";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
    return <VisitorError error={error} reset={reset} />;
}
