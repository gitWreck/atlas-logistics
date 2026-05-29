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
  faCircle,
  faPaperPlane,
  faSearch,
  faUserCheck,
} from "@fortawesome/free-solid-svg-icons";
import { db } from "@/lib/firebase";
import {
  assignConversation,
  markConversationRead,
  sendChatMessage,
  updateConversationStatus,
} from "@/app/utility/FirebaseFunctions";

function formatTime(value) {
  const date = value?.toDate?.() || null;
  if (!date) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

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
    await assignConversation({ conversationId: selectedId, assigneeId: user.uid });
  };

  const surface = isDark
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-50 text-slate-950";
  const panel = isDark
    ? "bg-slate-900 border-slate-800"
    : "bg-white border-slate-200";
  const muted = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div className={`h-[calc(100vh-57px)] min-h-[640px] ${surface}`}>
      <div className="grid h-full grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className={`border-r ${panel} flex min-h-0 flex-col`}>
          <div className="border-b border-inherit p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide">
                  Inbox
                </h2>
                <p className={`mt-1 text-xs ${muted}`}>
                  {unreadTotal} unread customer messages
                </p>
              </div>
              <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
                {conversations.length}
              </span>
            </div>

            <div
              className={`mt-4 flex h-10 items-center gap-2 rounded-lg border px-3 ${
                isDark
                  ? "border-slate-700 bg-slate-950"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <FontAwesomeIcon icon={faSearch} className={muted} size="sm" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                placeholder="Search customer, phone, tracking..."
              />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1">
              {["open", "pending", "resolved", "all"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`h-8 rounded-md text-xs font-semibold capitalize transition ${
                    statusFilter === status
                      ? "bg-slate-950 text-white"
                      : isDark
                        ? "bg-slate-800 text-slate-300"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className={`p-6 text-center text-sm ${muted}`}>
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
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full border-b border-inherit p-4 text-left transition ${
                      isSelected
                        ? isDark
                          ? "bg-slate-800"
                          : "bg-blue-50"
                        : isDark
                          ? "hover:bg-slate-800/70"
                          : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                        {getInitials(item.customerName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold">
                            {item.customerName || "Customer"}
                          </p>
                          <span className={`shrink-0 text-[11px] ${muted}`}>
                            {formatTime(item.lastMessageAt)}
                          </span>
                        </div>
                        <p className={`mt-1 truncate text-xs ${muted}`}>
                          {item.trackingNumber || "General support"}
                        </p>
                        <p className="mt-1 truncate text-sm">
                          {item.lastMessageText || "Conversation started"}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                            {item.status || "open"}
                          </span>
                          {item.priority === "urgent" && (
                            <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              urgent
                            </span>
                          )}
                          {unread > 0 && (
                            <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
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

        <section className="flex min-h-0 flex-col">
          {selected ? (
            <>
              <div className={`border-b ${panel} p-4`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-bold">
                        {selected.customerName || "Customer"}
                      </h2>
                      <FontAwesomeIcon
                        icon={faCircle}
                        className={
                          selected.status === "open"
                            ? "text-emerald-500"
                            : "text-slate-400"
                        }
                        size="2xs"
                      />
                    </div>
                    <p className={`mt-1 text-sm ${muted}`}>
                      {selected.customerPhone || "No phone"} ·{" "}
                      {selected.trackingNumber || "General support"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAssignToMe}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold"
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
                        className={`h-9 rounded-lg px-3 text-xs font-semibold capitalize ${
                          selected.status === status
                            ? "bg-blue-600 text-white"
                            : isDark
                              ? "bg-slate-800 text-slate-300"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                <div className="mx-auto flex max-w-4xl flex-col gap-3">
                  {messages.map((message) => {
                    const mine = message.senderId === user?.uid;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            mine
                              ? "rounded-br-md bg-blue-600 text-white"
                              : isDark
                                ? "rounded-bl-md bg-slate-800 text-slate-100"
                                : "rounded-bl-md bg-white text-slate-950"
                          }`}
                        >
                          <div
                            className={`mb-1 text-[11px] font-semibold ${
                              mine ? "text-blue-100" : muted
                            }`}
                          >
                            {message.senderName || "User"} ·{" "}
                            {formatTime(message.createdAt)}
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {message.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={listEndRef} />
                </div>
              </div>

              <form
                onSubmit={handleSend}
                className={`border-t ${panel} p-4`}
              >
                <div className="mx-auto flex max-w-4xl items-end gap-3">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={2}
                    className={`min-h-11 flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none ${
                      isDark
                        ? "border-slate-700 bg-slate-950 text-slate-100"
                        : "border-slate-200 bg-white text-slate-950"
                    }`}
                    placeholder={
                      selected.status === "closed"
                        ? "Conversation is closed"
                        : "Type a reply..."
                    }
                    disabled={selected.status === "closed"}
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
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <FontAwesomeIcon icon={faPaperPlane} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className={`flex flex-1 items-center justify-center ${muted}`}>
              Select a conversation to start replying.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
