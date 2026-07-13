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
        <div className="fixed bottom-5 right-5 z-50 flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-[1.75rem] border border-slate-700 bg-slate-950 text-white shadow-[0_28px_80px_rgba(15,23,42,0.45)] sm:bottom-6 sm:right-6 sm:h-[32rem]">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-200">
                Atlas Support
              </p>
              <h2 className="mt-1 text-base font-black">Live Chat</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:bg-slate-800"
              aria-label="Close chat"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Connecting to support...
              </div>
            ) : (
              <div className="flex w-full min-w-0 flex-col gap-3">
                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm leading-7 text-slate-300">
                    Send a message to reach the Atlas operations desk. Works with
                    or without an account.
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = message.senderId === chatUid;
                    return (
                      <div
                        key={message.id}
                        className={`flex min-w-0 w-full ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`min-w-0 max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            mine
                              ? "rounded-br-md bg-blue-600 text-white"
                              : "rounded-bl-md border border-slate-800 bg-slate-900 text-slate-100"
                          }`}
                        >
                          <div
                            className={`mb-1 break-words text-[11px] font-semibold ${
                              mine ? "text-blue-100" : "text-slate-400"
                            }`}
                          >
                            {message.senderName || (mine ? "You" : "Atlas Support")}{" "}
                            · {formatFirestoreDate(message.createdAt) || "Now"}
                          </div>
                          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed">
                            {message.text}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={listEndRef} />
              </div>
            )}
          </div>

          {!loading && (
            <form
              onSubmit={handleSubmit}
              className="border-t border-slate-800 p-4"
            >
              {errorMessage && (
                <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-6 text-red-100">
                  {errorMessage}
                </p>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  rows={2}
                  disabled={loading || sending}
                  placeholder="Type your message..."
                  className="min-h-11 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <FontAwesomeIcon
                    icon={sending ? faTimes : faPaperPlane}
                    className={sending ? "animate-pulse" : ""}
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
