"use client";
import ActivityFeed from "@/components/ActivityFeed";

export default function ActivityPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2 text-ivory">
          Activity
        </h1>
        <p className="text-[13px] text-ash">
          Recent transactions across all markets
        </p>
      </div>
      <div className="holo-card p-5">
        <ActivityFeed limit={50} />
      </div>
    </main>
  );
}
