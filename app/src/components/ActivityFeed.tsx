"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useProgram } from "@/hooks/useProgram";
import { useRealtime } from "@/hooks/useRealtime";
import { shortAddr, timeUntil } from "@/lib/format";

interface ActivityEntry {
  id: string;
  marketId: number;
  marketQuestion: string;
  user: string;
  type: "buy" | "sell" | "claim" | "refund" | "settle";
  side?: "yes" | "no";
  amount?: number;
  timestamp: number;
}

export default function ActivityFeed({ limit = 20 }: { limit?: number }) {
  const { program, connection } = useProgram();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const activitiesRef = useRef(activities);
  activitiesRef.current = activities;

  useRealtime("global:activity", (payload: unknown) => {
    const entry = payload as ActivityEntry;
    setActivities((prev) => [entry, ...prev].slice(0, limit));
  });

  const fetchActivities = useCallback(async () => {
    const fetchFromDbApi = async () => {
      try {
        const res = await fetch('/api/activity/recent');
        if (!res.ok) return false;
        const data = await res.json();
        if (data && data.ok && data.activities?.length > 0) {
          const entries = data.activities.map((a: any) => ({
            id: a.signature,
            marketId: 0,
            marketQuestion: a.question || (a.marketPubkey ? shortAddr(a.marketPubkey) : 'Market Trade'),
            user: shortAddr(a.trader),
            type: (a.side === 'YES' || a.side === 'NO') ? 'buy' : 'claim',
            side: a.side?.toLowerCase() as 'yes' | 'no' | undefined,
            timestamp: a.blockTime ? Math.floor(new Date(a.blockTime).getTime() / 1000) : Math.floor(Date.now() / 1000),
          }));
          setActivities(entries);
        } else {
          setActivities([]);
        }
      } catch {
        setActivities([]);
      }
    };

    if (!connection || !program?.programId) {
      await fetchFromDbApi();
      setLoading(false);
      return;
    }

    try {
      const entries: ActivityEntry[] = [];
      const sigs = await connection.getSignaturesForAddress(
        program.programId,
        { limit: 50 },
        "confirmed"
      );
      if (sigs.length === 0) throw new Error("empty");
      for (const sig of sigs.slice(0, limit)) {
        try {
          const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });
          if (!tx?.meta?.logMessages) continue;
          const logs = tx.meta.logMessages.join(" ");
          const msg = tx.transaction.message as unknown as { staticAccountKeys?: import("@solana/web3.js").PublicKey[]; accountKeys?: Array<{ toBase58(): string }> };
          const signer = (msg.staticAccountKeys?.[0] ?? msg.accountKeys?.[0])?.toBase58() ?? "";
          const ts = sig.blockTime ?? Math.floor(Date.now() / 1000);

          if (logs.includes("buy_shares") || logs.includes("purchased")) {
            const marketMatch = logs.match(/market_(\d+)/i);
            entries.push({
              id: sig.signature,
              marketId: marketMatch ? parseInt(marketMatch[1]) : 0,
              marketQuestion: "",
              user: shortAddr(signer),
              type: "buy",
              timestamp: ts,
            });
          } else if (logs.includes("sell")) {
            entries.push({
              id: sig.signature,
              marketId: 0,
              marketQuestion: "",
              user: shortAddr(signer),
              type: "sell",
              timestamp: ts,
            });
          } else if (logs.includes("claim") || logs.includes("RewardsClaimed")) {
            entries.push({
              id: sig.signature,
              marketId: 0,
              marketQuestion: "",
              user: shortAddr(signer),
              type: "claim",
              timestamp: ts,
            });
          }
        } catch {
        }
      }
      if (entries.length > 0) {
        setActivities(entries);
      } else {
        await fetchFromDbApi();
      }
    } catch {
      await fetchFromDbApi();
    } finally {
      setLoading(false);
    }
  }, [connection, program, limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  if (loading) {
    return (
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-text-secondary)", padding: "16px" }}>
        Loading activity...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-text-secondary)", padding: "16px", textAlign: "center" }}>
        No recent activity
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {activities.map((a) => (
        <div
          key={a.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            borderBottom: "1px solid var(--color-surface-variant)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <ActivityIcon type={a.type} />
            <span style={{ color: "var(--color-text-primary)" }}>{a.user}</span>
            <span style={{ color: "var(--color-text-secondary)" }}>
              {typeLabel(a.type)}
            </span>
          </div>
          <span style={{ color: "var(--color-outline)", fontSize: "11px" }}>
            {timeUntil(a.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    buy: "var(--color-yes)",
    sell: "var(--color-no)",
    claim: "var(--color-primary)",
    refund: "var(--color-outline)",
    settle: "var(--color-crypto)",
  };
  return (
    <span style={{ color: colorMap[type] ?? "var(--color-text-secondary)" }}>
      {type === "buy" ? "B" : type === "sell" ? "S" : type === "claim" ? "C" : type === "refund" ? "R" : "?"}
    </span>
  );
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    buy: "bought",
    sell: "sold",
    claim: "claimed",
    refund: "refunded",
    settle: "settled",
  };
  return labels[type] ?? type;
}