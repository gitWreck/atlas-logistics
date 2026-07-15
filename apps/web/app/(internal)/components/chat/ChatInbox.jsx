"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faPaperPlane,
  faSearch,
  faTimes,
  faUserCheck,
} from "@fortawesome/free-solid-svg-icons";
import { db } from "@/lib/firebase";
import {
  assignConversation,
  markConversationRead,
  sendChatMessage,
  updateConversationStatus,
} from "@/app/utility/FirebaseFunctions";
import { formatFirestoreDate } from "@/app/utility/utilities";

function getInitials(name = "C") {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function ChatInbox({ user, isDark = false }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const listEndRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, "conversations"),
      orderBy("lastMessageAt", "desc"),
      limit(100),
    );

    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setConversations(items);
      setSelectedId((current) => current || items[0]?.id || null);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return undefined;
    }

    markConversationRead({ conversationId: selectedId }).catch(() => {});

    const q = query(
      collection(db, "conversations", selectedId, "messages"),
      orderBy("createdAt", "asc"),
      limit(200),
    );

    return onSnapshot(q, (snapshot) => {
      setMessages(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })),
      );
    });
  }, [selectedId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedId]);

  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedId) || null,
    [conversations, selectedId],
  );

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations.filter((item) => {
      const status = String(item.status || "open").toLowerCase();
      const matchesStatus =
        statusFilter === "all" ? true : status === statusFilter;
      const haystack = [
        item.customerName,
        item.customerPhone,
        item.trackingNumber,
        item.lastMessageText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [conversations, search, statusFilter]);

  const unreadTotal = conversations.reduce(
    (sum, item) => sum + Number(item.unreadCounts?.staff || 0),
    0,
  );

  const handleSend = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!selectedId || !text || sending) return;

    try {
      setSending(true);
      await sendChatMessage({ conversationId: selectedId, text });
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const handleStatus = async (status) => {
    if (!selectedId) return;
    await updateConversationStatus({ conversationId: selectedId, status });
  };

  const handleAssignToMe = async () => {
    if (!selectedId || !user?.uid) return;
    await assignConversation({
      conversationId: selectedId,
      assigneeId: user.uid,
    });
  };

  const surface = isDark
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-50 text-slate-950";
  const panel = isDark
    ? "border-white/10 bg-slate-950/80"
    : "border-slate-200 bg-white";
  const divider = isDark ? "border-white/10" : "border-slate-200";
  const muted = isDark ? "text-slate-500" : "text-slate-500";
  const softFill = isDark ? "bg-white/[0.06]" : "bg-slate-100";
  const softHover = isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50";
  const selectedRow = isDark ? "bg-white/[0.07]" : "bg-slate-100";
  const chipIdle = isDark
    ? "bg-white/[0.05] text-slate-400"
    : "bg-slate-100 text-slate-600";
  const chipActive = isDark
    ? "bg-white text-slate-950"
    : "bg-slate-900 text-white";
  const avatar = isDark
    ? "bg-white/10 text-slate-200"
    : "bg-slate-200 text-slate-700";
  const incomingBubble = isDark
    ? "rounded-bl-sm bg-slate-700/90 text-slate-50"
    : "rounded-bl-sm bg-slate-200/90 text-slate-950";
  const composer = isDark
    ? "bg-white/8 ring-white/10 focus-within:ring-white/20"
    : "bg-slate-100 ring-slate-200 focus-within:ring-slate-300";

  return (
    <div className={`h-full min-h-0 ${surface}`}>
      <div className="grid h-full grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          className={`min-h-0 flex-col border-r ${panel} ${
            mobileThreadOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className={`border-b ${divider} px-5 py-4`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
                  Inbox
                </h2>
                <p className={`mt-1 text-[11px] font-medium ${muted}`}>
                  {unreadTotal} unread customer messages
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${
                  isDark
                    ? "bg-white/10 text-slate-200"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {conversations.length}
              </span>
            </div>

            <div
              className={`mt-4 flex h-10 items-center gap-2 rounded-full px-3 ring-1 ring-inset ${
                isDark
                  ? "bg-white/[0.04] ring-white/10"
                  : "bg-slate-50 ring-slate-200"
              }`}
            >
              <FontAwesomeIcon icon={faSearch} className={muted} size="sm" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-500"
                placeholder="Search customer, phone, tracking..."
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-4">
              {["open", "pending", "resolved", "all"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`h-8 rounded-full text-[11px] font-semibold capitalize transition ${
                    statusFilter === status ? chipActive : chipIdle
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {filteredConversations.length === 0 ? (
              <div className={`p-6 text-center text-[13px] ${muted}`}>
                No conversations found.
              </div>
            ) : (
              filteredConversations.map((item) => {
                const isSelected = item.id === selectedId;
                const unread = Number(item.unreadCounts?.staff || 0);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setMobileThreadOpen(true);
                    }}
                    className={`w-full border-b px-5 py-3.5 text-left transition ${divider} ${
                      isSelected ? selectedRow : softHover
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${avatar}`}
                      >
                        {getInitials(item.customerName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold tracking-[-0.01em]">
                            {item.customerName || "Customer"}
                          </p>
                          <span
                            className={`shrink-0 text-[10px] tabular-nums ${muted}`}
                          >
                            {formatFirestoreDate(item.lastMessageAt) ||
                              "Recently"}
                          </span>
                        </div>
                        <p className={`mt-0.5 truncate text-[11px] ${muted}`}>
                          {item.isGuest
                            ? "Website guest"
                            : item.trackingNumber || "General support"}
                        </p>
                        <p
                          className={`mt-1 truncate text-[13px] leading-5 ${
                            isDark ? "text-slate-300" : "text-slate-700"
                          }`}
                        >
                          {item.lastMessageText || "Conversation started"}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.02em] ${softFill} ${muted}`}
                          >
                            {item.status || "open"}
                          </span>
                          {item.priority === "urgent" && (
                            <span className="rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                              urgent
                            </span>
                          )}
                          {unread > 0 && (
                            <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section
          className={`min-h-0 flex-col ${
            mobileThreadOpen ? "flex" : "hidden lg:flex"
          }`}
        >
          {selected ? (
            <>
              <div className={`border-b ${divider} ${panel} px-5 py-4`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setMobileThreadOpen(false)}
                      className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg lg:hidden ${
                        isDark
                          ? "text-slate-400 hover:bg-white/5 hover:text-white"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      aria-label="Back to conversations"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} size="sm" />
                    </button>

                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          selected.status === "open"
                            ? "bg-slate-400"
                            : "bg-slate-600"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em]">
                          {selected.customerName || "Customer"}
                        </h2>
                        <p
                          className={`mt-0.5 truncate text-[11px] font-medium ${muted}`}
                        >
                          {selected.isGuest
                            ? "Website guest"
                            : selected.customerPhone || "No phone"}{" "}
                          · {selected.trackingNumber || "General support"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                      type="button"
                      onClick={handleAssignToMe}
                      className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-[11px] font-semibold transition ${chipIdle}`}
                    >
                      <FontAwesomeIcon icon={faUserCheck} />
                      {selected.assignedTo === user?.uid
                        ? "Assigned"
                        : "Assign to me"}
                    </button>
                    {["open", "pending", "resolved", "closed"].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleStatus(status)}
                        className={`h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold capitalize transition ${
                          selected.status === status
                            ? status === "open"
                              ? "bg-blue-600 text-white"
                              : chipActive
                            : chipIdle
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-2">
                  {messages.length === 0 ? (
                    <div className="flex min-h-[10rem] flex-col items-center justify-center text-center">
                      <p className={`text-[13px] font-medium ${muted}`}>
                        No messages yet. Send the first reply.
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const mine = message.senderId === user?.uid;
                      return (
                        <div
                          key={message.id}
                          className={`flex min-w-0 w-full ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`min-w-0 max-w-[82%] rounded-xl px-3.5 py-2 ${
                              mine
                                ? "rounded-br-sm bg-blue-600 text-white"
                                : incomingBubble
                            }`}
                          >
                            <div className="mb-0.5 flex min-w-0 items-baseline gap-1.5">
                              <span
                                className={`truncate text-[11px] font-medium tracking-[0.01em] ${
                                  mine
                                    ? "text-white/70"
                                    : isDark
                                      ? "text-slate-300/80"
                                      : "text-slate-600"
                                }`}
                              >
                                {message.senderName || "User"}
                              </span>
                              <span
                                className={`shrink-0 text-[10px] font-normal tabular-nums ${
                                  mine
                                    ? "text-white/40"
                                    : isDark
                                      ? "text-slate-400/55"
                                      : "text-slate-400"
                                }`}
                              >
                                {formatFirestoreDate(message.createdAt) ||
                                  "Recently"}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap break-words text-[15px] leading-6 tracking-[-0.01em] [overflow-wrap:anywhere]">
                              {message.text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={listEndRef} />
                </div>
              </div>

              <form
                onSubmit={handleSend}
                className={`border-t ${divider} px-5 pb-5 pt-4`}
              >
                <div
                  className={`mx-auto flex max-w-2xl items-end gap-1 rounded-full px-2 py-1.5 ring-1 ring-inset ${composer}`}
                >
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={1}
                    className="min-h-9 max-h-24 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2 text-[15px] leading-5 tracking-[-0.01em] outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    placeholder={
                      selected.status === "closed"
                        ? "Conversation is closed"
                        : "Type a reply..."
                    }
                    disabled={selected.status === "closed" || sending}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend(event);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={
                      !draft.trim() || sending || selected.status === "closed"
                    }
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
            </>
          ) : (
            <div
              className={`flex flex-1 items-center justify-center text-[13px] font-medium ${muted}`}
            >
              Select a conversation to start replying.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
