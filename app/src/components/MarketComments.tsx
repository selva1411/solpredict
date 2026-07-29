"use client";

import React, { useState, useEffect } from "react";
import { useProgram } from "@/hooks/useProgram";
import { MessageSquare, Send, ThumbsUp, User } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id?: number;
  authorWallet: string;
  authorUsername?: string;
  authorAvatar?: string;
  content: string;
  upvotes?: number;
  createdAt?: string | Date;
}

export function MarketComments({ marketPubkey }: { marketPubkey: string }) {
  const { wallet } = useProgram();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/markets/${marketPubkey}/comments`);
      const data = await res.json();
      if (data.ok) {
        setComments(data.comments);
      }
    } catch (e) {
      console.error("Fetch comments error:", e);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [marketPubkey]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet?.publicKey) {
      toast.error("Please connect your wallet to post a comment.");
      return;
    }
    if (!newCommentText.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/markets/${marketPubkey}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorWallet: wallet.publicKey.toBase58(),
          authorUsername: `${wallet.publicKey.toBase58().slice(0, 4)}...${wallet.publicKey.toBase58().slice(-4)}`,
          content: newCommentText.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Comment posted!");
        setNewCommentText("");
        fetchComments();
      } else {
        toast.error(`Post failed: ${data.error}`);
      }
    } catch (err: unknown) {
      toast.error(`Failed to post comment: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#F4F5FA] flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#ffd89c]" />
          <span>Community Discussion ({comments.length})</span>
        </h3>
        <span className="text-[10px] font-mono text-[#A5A8B8]">Decentralized Discussion Layer</span>
      </div>

      {/* Post comment input */}
      <form onSubmit={handlePostComment} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={wallet?.publicKey ? "Share your prediction rationale or technical analysis..." : "Connect wallet to join discussion..."}
            value={newCommentText}
            disabled={!wallet?.publicKey || submitting}
            onChange={(e) => setNewCommentText(e.target.value)}
            className="flex-1 bg-[#0A0B12] border border-white/10 rounded-lg px-4 py-2.5 text-xs text-[#F4F5FA] placeholder-[#A5A8B8]/50 focus:outline-none focus:border-[#7B3FE4]/60 font-mono disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!wallet?.publicKey || !newCommentText.trim() || submitting}
            className="px-4 py-2.5 bg-[#ffd89c] text-[#131313] font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-[#ffe3b8] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post</span>
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-3 font-mono text-xs max-h-80 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <p className="text-center text-[11px] text-[#A5A8B8] py-4">No comments yet. Be the first trader to post analysis!</p>
        ) : (
          comments.map((comment, index) => {
            const timeAgo = comment.createdAt ? new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now';
            return (
              <div key={index} className="p-3 rounded-lg bg-[#0A0B12] border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img
                      src={comment.authorAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${comment.authorWallet}`}
                      alt="avatar"
                      className="w-5 h-5 rounded-full bg-white/10"
                    />
                    <span className="font-bold text-[#ffd89c] text-[11px]">
                      {comment.authorUsername || `${comment.authorWallet.slice(0, 4)}...`}
                    </span>
                    <span className="text-[9px] text-[#A5A8B8]">{timeAgo}</span>
                  </div>
                  <button className="flex items-center gap-1 text-[10px] text-[#A5A8B8] hover:text-[#22c55e] transition-colors cursor-pointer">
                    <ThumbsUp className="w-3 h-3" />
                    <span>{comment.upvotes || 0}</span>
                  </button>
                </div>
                <p className="text-[#F4F5FA] text-[11px] font-sans leading-relaxed">{comment.content}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
