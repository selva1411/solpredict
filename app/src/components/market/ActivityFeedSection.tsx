import React from "react";
import { Activity } from "lucide-react";
import { EmptyState, LiveIndicator } from "@/components/StatePanels";

interface ActivityItem {
  signature: string;
  slot: number;
  buyer: string;
  side: "YES" | "NO" | "SETTLE" | "CLAIM";
  quantity: number;
  cost: number;
  time: string;
}

export function ActivityFeedSection({ activity }: { activity: ActivityItem[] }) {
  return (
    <div className="surface p-6 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider font-display text-ash flex items-center space-x-2">
        <Activity className="w-4 h-4 text-gold" />
        <span>Decoded On-Chain Transactions</span>
        <div className="ml-auto flex items-center gap-2">
          <LiveIndicator isLive={activity.length > 0} label={activity.length > 0 ? "Streaming" : "Idle"} />
        </div>
      </h3>

      <div className="space-y-2 font-mono text-xs max-h-96 overflow-y-auto scrollbar-thin">
        {activity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No Transactions Yet"
            description="No matching transaction logs decoded. New activity will appear here in real-time."
          />
        ) : (
          activity.map((item, index) => {
            const isSettle = item.side === "SETTLE";
            const isClaim = item.side === "CLAIM";
            const isYes = item.side === "YES";
            const isNo = item.side === "NO";
            const isNew = index < 3;

            let badgeColor = "bg-panel-2 text-ivory";
            if (isYes) badgeColor = "bg-verdigris/10 text-verdigris border border-verdigris/20";
            if (isNo) badgeColor = "bg-bordeaux/10 text-bordeaux border border-bordeaux/20";
            if (isSettle) badgeColor = "bg-gold/10 text-gold border border-gold/20";

            return (
              <div
                key={item.signature + "-" + index}
                className={`flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-hairline/10 hover:bg-ivory/5 px-2 rounded gap-1 sm:gap-0 ${isNew ? "bg-verdigris/5" : ""}`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${badgeColor}`}>
                    {item.side}
                  </span>
                  <span className="text-ivory text-[11px] truncate">
                    {isSettle ? (
                      <span>BOARD FINALIZED (OUTCOME {item.quantity === 1 ? "YES" : "NO"})</span>
                    ) : isClaim ? (
                      <span>REWARD WITHDRAWAL: {item.cost.toFixed(2)} SOL</span>
                    ) : (
                      <span>{item.quantity} SHARES AT {item.cost.toFixed(2)} SOL</span>
                    )}
                  </span>
                  {isNew && (
                    <span className="text-[8px] font-mono font-bold text-verdigris bg-verdigris/10 px-1 py-0.5 rounded border border-verdigris/20 shrink-0">
                      NEW
                    </span>
                  )}
                </div>
                <div className="text-ash text-[10px] flex items-center space-x-2 ml-7 sm:ml-0">
                  <span className="hidden sm:inline">@{item.buyer.slice(0, 4)}...</span>
                  <span>{item.time}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
