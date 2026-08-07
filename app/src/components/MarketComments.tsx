"use client";

import React, { useState, useEffect } from "react";
import { useProgram } from "@/hooks/useProgram";
import { MessageSquare, Send, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id?: number;
  marketPubkey?: string;
  authorWallet: string;
  authorUsername?: string;
  authorAvatar?: string;
  content: string;
  parentId?: number;
  upvotes?: number;
  createdAt?: string | Date;
}

interface CommentNode {
  comment: Comment;
  replies: CommentNode[];
}

export function MarketComments({ marketPubkey }: { marketPubkey: string }) {
  const { wallet } = useProgram();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    try {
      if (!marketPubkey || marketPubkey === "11111111111111111111111111111111") return;
      const res = await fetch(`/api/markets/${marketPubkey}/comments`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.ok) {
        setComments(data.comments || []);
      }
    } catch (e) {
      console.error("Fetch comments error:", e);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [marketPubkey]);

  const postComment = async (content: string, parentId?: number) => {
    if (!wallet?.publicKey) {
      toast.error("Please connect your wallet to post a comment.");
      return;
    }
    if (!content.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/markets/${marketPubkey}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorWallet: wallet.publicKey.toBase58(),
          authorUsername: `${wallet.publicKey.toBase58().slice(0, 4)}...${wallet.publicKey.toBase58().slice(-4)}`,
          content: content.trim(),
          parentId: parentId ?? null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(parentId ? "Reply posted!" : "Comment posted!");
        fetchComments();
        return true;
      } else {
        toast.error(`Post failed: ${data.error}`);
        return false;
      }
    } catch (err: unknown) {
      toast.error(`Failed to post comment: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await postComment(newCommentText)) setNewCommentText("");
  };

  const handlePostReply = async (parentId: number) => {
    if (await postComment(replyText, parentId)) {
      setReplyText("");
      setReplyTo(null);
    }
  };

  const handleUpvote = async (comment: Comment) => {
    if (!comment.id) return;
    const prev = comment.upvotes || 0;
    setComments(prevComments =>
      prevComments.map(c => c.id === comment.id ? { ...c, upvotes: prev + 1 } : c)
    );
    try {
      const res = await fetch(`/api/markets/${marketPubkey}/comments/${comment.id}/upvote`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setComments(prevComments =>
          prevComments.map(c => c.id === comment.id ? { ...c, upvotes: prev } : c)
        );
      }
    } catch {
      setComments(prevComments =>
        prevComments.map(c => c.id === comment.id ? { ...c, upvotes: prev } : c)
      );
    }
  };

  const buildTree = (flat: Comment[]): CommentNode[] => {
    const nodes = new Map<number, CommentNode>();
    const roots: CommentNode[] = [];
    flat.forEach(c => nodes.set(c.id as number, { comment: c, replies: [] }));
    flat.forEach(c => {
      const node = nodes.get(c.id as number)!;
      if (c.parentId && nodes.has(c.parentId)) {
        nodes.get(c.parentId)!.replies.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const tree = buildTree(comments);

  const CommentItem = ({ node, depth }: { node: CommentNode; depth: number }) => {
    const { comment } = node;
    const timeAgo = comment.createdAt
      ? new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "just now";
    const isReplying = replyTo === comment.id;

    return (
      <div className={depth > 0 ? "ml-5 border-l border-white/10 pl-3" : ""}>
        <div className="p-3 rounded-lg bg-[#1A1C22] border border-white/10 space-y-1.5">
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
              <span className="text-[9px] text-[#808495]">{timeAgo}</span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleUpvote(comment)}
                className="flex items-center gap-1 text-[10px] text-[#808495] hover:text-[#22c55e] transition-colors cursor-pointer"
              >
                <ThumbsUp className="w-3 h-3" />
                <span>{comment.upvotes || 0}</span>
              </button>
              <button
                onClick={() => {
                  if (!wallet?.publicKey) return toast.error("Please connect your wallet to reply.");
                  setReplyTo(isReplying ? null : (comment.id as number));
                  setReplyText("");
                }}
                className="flex items-center gap-1 text-[10px] text-[#808495] hover:text-[#ffd89c] transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Reply</span>
              </button>
            </div>
          </div>
          <p className="text-[#F4F4F9] text-[11px] font-sans leading-relaxed">{comment.content}</p>

          {isReplying && (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePostReply(comment.id as number);
                  }
                }}
                placeholder="Write a reply..."
                className="flex-1 bg-[#1A1C22] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F4F4F9] placeholder-[#808495]/50 focus:outline-none focus:border-[#FFA500]/60 font-mono"
              />
              <button
                onClick={() => handlePostReply(comment.id as number)}
                disabled={!replyText.trim() || submitting}
                className="px-3 py-2 bg-[#FFA500]/20 text-[#ffd89c] font-bold text-[10px] uppercase tracking-wider rounded-lg hover:bg-[#FFA500]/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reply
              </button>
            </div>
          )}
        </div>
        {node.replies.map((child, i) => (
          <CommentItem key={i} node={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#F4F4F9] flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#ffd89c]" />
          <span>Community Discussion ({comments.length})</span>
        </h3>
        <span className="text-[10px] font-mono text-[#808495]">Decentralized Discussion Layer</span>
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
            className="flex-1 bg-[#1A1C22] border border-white/10 rounded-lg px-4 py-2.5 text-xs text-[#F4F4F9] placeholder-[#808495]/50 focus:outline-none focus:border-[#FFA500]/60 font-mono disabled:opacity-50"
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
        {tree.length === 0 ? (
          <p className="text-center text-[11px] text-[#808495] py-4">No comments yet. Be the first trader to post analysis!</p>
        ) : (
          tree.map((node, index) => (
            <CommentItem key={index} node={node} depth={0} />
          ))
        )}
      </div>
    </div>
  );
}
