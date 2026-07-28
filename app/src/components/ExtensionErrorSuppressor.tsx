"use client";

import { useEffect } from "react";

export function ExtensionErrorSuppressor() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const filename = event.filename || "";
      const message = event.message || "";
      if (
        filename.includes("chrome-extension:") ||
        filename.includes("moz-extension:") ||
        message.includes("WalletLinkWebSocket") ||
        message.includes("websocket error 1006")
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event.reason || "");
      if (
        reason.includes("WalletLinkWebSocket") ||
        reason.includes("websocket error 1006") ||
        reason.includes("chrome-extension:")
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleError, true);
    window.addEventListener("unhandledrejection", handleRejection, true);

    return () => {
      window.removeEventListener("error", handleError, true);
      window.removeEventListener("unhandledrejection", handleRejection, true);
    };
  }, []);

  return null;
}
