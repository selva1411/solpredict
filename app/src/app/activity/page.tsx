"use client";
import ActivityFeed from "@/components/ActivityFeed";
import { LabelLux } from "@/components/ui/label-lux";

export default function ActivityPage() {
  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 py-14">
      <div className="mb-8">
        <LabelLux className="mb-2">Activity</LabelLux>
        <h1 className="font-display text-[46px] font-semibold uppercase text-ivory">
          The Tape
        </h1>
        <p className="text-[13px] text-ash mt-2">
          Recent transactions across all markets
        </p>
      </div>
      <div className="surface p-5">
        <ActivityFeed limit={50} />
      </div>
    </main>
  );
}