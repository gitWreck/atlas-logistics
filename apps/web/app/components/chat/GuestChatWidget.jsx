"use client";

import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faComments,
  faPaperPlane,
  faTimes,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";

export default function GuestChatWidget({
  isOpen,
  onClose,
  onOpen,
  messages,
  draft,
  onDraftChange,
  onSend,
  sending,
  loading,
  chatUid,
  errorMessage,
}) {
  const listEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (isOpen && !loading) {
      inputRef.current?.focus();
    }
  }, [isOpen, loading]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSend();
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_18px_40px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-300/40 sm:bottom-6 sm:right-6"
          aria-label="Open live chat"
        >
          <FontAwesomeIcon icon={faComments} className="text-xl" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/80 text-white shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl sm:bottom-6 sm:right-6 sm:h-[32rem]">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-slate-400"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-white">
                  Live Chat
                </h2>
                <p className="truncate text-[11px] font-medium tracking-[0.01em] text-slate-500">
                  Atlas Support
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Close chat"
            >
              <FontAwesomeIcon icon={faXmark} className="text-sm" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {loading ? (
              <div className="flex h-full items-center justify-center text-[13px] font-medium text-slate-500">
                Connecting to support...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full min-h-[10rem] flex-col items-center justify-center px-1 py-2 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                  <FontAwesomeIcon icon={faComments} className="text-base" />
                </div>
                <p className="mt-3.5 text-[15px] font-medium tracking-[-0.01em] text-slate-100">
                  Message the operations desk
                </p>
                <p className="mt-1.5 max-w-[15rem] text-[13px] leading-5 text-slate-400">
                  Ask about tracking, pickup, or schedules. Works with or
                  without an account.
                </p>
                <p className="mt-3 text-[11px] font-medium tracking-[0.02em] text-slate-500">
                  Ops is usually online
                </p>
              </div>
            ) : (
              <div className="mx-auto flex w-full min-w-0 max-w-[22rem] flex-col gap-2">
                <div className="mx-auto mb-0.5 max-w-[16rem] rounded-full bg-white/[0.04] px-3 py-1 text-center text-[11px] leading-4 text-slate-500">
                  Atlas Support · tracking, pickup &amp; schedules
                </div>
                {messages.map((message) => {
                  const mine = message.senderId === chatUid;
                  return (
                    <div
                      key={message.id}
                      className={`flex min-w-0 w-full ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`min-w-0 max-w-[82%] rounded-xl px-3.5 py-2 ${
                          mine
                            ? "rounded-br-sm bg-blue-600 text-white"
                            : "rounded-bl-sm bg-slate-700/90 text-slate-50"
                        }`}
                      >
                        <div className="mb-0.5 flex min-w-0 items-baseline gap-1.5">
                          <span
                            className={`truncate text-[11px] font-medium tracking-[0.01em] ${
                              mine ? "text-white/70" : "text-slate-300/80"
                            }`}
                          >
                            {message.senderName ||
                              (mine ? "You" : "Atlas Support")}
                          </span>
                          <span
                            className={`shrink-0 text-[10px] font-normal tabular-nums ${
                              mine ? "text-white/40" : "text-slate-400/55"
                            }`}
                          >
                            {formatFirestoreDate(message.createdAt) || "Now"}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-6 tracking-[-0.01em] [overflow-wrap:anywhere]">
                          {message.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={listEndRef} />
              </div>
            )}
          </div>

          {!loading && (
            <form
              onSubmit={handleSubmit}
              className="border-t border-white/10 px-5 pb-5 pt-4"
            >
              {errorMessage && (
                <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] leading-5 text-red-100">
                  {errorMessage}
                </p>
              )}
              <div className="flex items-end gap-1 rounded-full bg-white/8 px-2 py-1.5 ring-1 ring-inset ring-white/10 focus-within:ring-white/20">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  rows={1}
                  disabled={loading || sending}
                  placeholder="Type your message..."
                  className="min-h-9 max-h-24 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2 text-[15px] leading-5 tracking-[-0.01em] text-white outline-none placeholder:text-slate-500 placeholder:tracking-normal disabled:cursor-not-allowed disabled:opacity-60 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      onSend();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || sending || !draft.trim()}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:opacity-40"
                  aria-label="Send message"
                >
                  <FontAwesomeIcon
                    icon={sending ? faTimes : faPaperPlane}
                    className={`text-sm ${sending ? "animate-pulse" : ""}`}
                  />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
