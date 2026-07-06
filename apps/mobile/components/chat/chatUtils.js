// Shared, dependency-free helpers for the customer chat experience.
// Pure functions only — no React imports here so this stays easy to test/reuse.

// ---------------------------------------------------------------------------
// Attachment encoding — kept byte-for-byte compatible with the web ChatInbox
// (apps/web/app/(internal)/components/chat/ChatInbox.jsx) so images/files sent
// from either surface render correctly on the other.
// ---------------------------------------------------------------------------
export const TEXT_ATTACHMENT_PREFIX = "ATLAS_ATTACHMENT:";

export function encodeTextAttachment({ url, type, name }) {
  return `${TEXT_ATTACHMENT_PREFIX}${encodeURIComponent(
    JSON.stringify({ url, type, name }),
  )}`;
}

export function parseTextAttachment(text = "") {
  const rawText = String(text || "").trim();
  if (!rawText.startsWith(TEXT_ATTACHMENT_PREFIX)) return null;
  try {
    const payload = JSON.parse(
      decodeURIComponent(rawText.slice(TEXT_ATTACHMENT_PREFIX.length)),
    );
    if (!payload?.url || !payload?.type) return null;
    return payload;
  } catch {
    return null;
  }
}

// Resolves an attachment from either the encoded-text scheme or the dedicated
// attachment fields written by the Cloud Function / web client.
export function getMessageAttachment(message = {}) {
  const fromText = parseTextAttachment(message.text);
  if (fromText) return fromText;
  if (message.attachmentUrl && message.attachmentType) {
    return {
      url: message.attachmentUrl,
      type: message.attachmentType,
      name: message.attachmentName || "Photo",
    };
  }
  return null;
}

// True when a message row carries only an attachment and no human-typed text.
export function getMessageText(message = {}) {
  const raw = String(message?.text || "");
  if (raw.startsWith(TEXT_ATTACHMENT_PREFIX)) return "";
  // "File: name\nurl" scheme used by the web client for non-image files.
  if (message.attachmentUrl && raw.startsWith("File: ")) return "";
  return raw;
}

// Short preview shown in the conversation list.
export function displayMessagePreview(message = {}) {
  const attachment = getMessageAttachment(message);
  if (attachment?.type === "image") return "📷 Photo";
  if (attachment?.type === "file") return `📎 ${attachment.name || "File"}`;
  const raw = String(message?.text || "");
  if (raw.startsWith("File: ")) return "📎 File";
  return getMessageText(message) || message?.lastMessageText || "";
}

// ---------------------------------------------------------------------------
// Date / time formatting
// ---------------------------------------------------------------------------
function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Compact, Messenger-style relative label for the conversation list ("now",
// "5m", "3h", "Mon", "Sep 12").
export function formatListTime(value) {
  const date = toDate(value);
  if (!date) return "";
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  }
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

// Clock time inside a bubble / timestamp separator.
export function formatClockTime(value) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// Section header shown between messages sent on different days.
export function formatDayDivider(value) {
  const date = toDate(value);
  if (!date) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayMs = 86400000;
  const diffDays = Math.round((startOfToday - startOfDate) / dayMs);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

export function isSameDay(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function timeValue(value) {
  const date = toDate(value);
  return date ? date.getTime() : 0;
}

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------
const AVATAR_PALETTE = [
  ["#0A7CFF", "#0064E0"],
  ["#F5533D", "#E11D48"],
  ["#00A400", "#059669"],
  ["#7A5FFF", "#6D28D9"],
  ["#F7A928", "#EA580C"],
  ["#00B5C8", "#0891B2"],
  ["#EC4899", "#DB2777"],
  ["#5A7FA6", "#475569"],
];

export function avatarGradient(seed = "") {
  const key = String(seed || "A");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export function initials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
export function getStatusMeta(status) {
  const normalized = String(status || "open").toLowerCase();
  switch (normalized) {
    case "pending":
      return { label: "Pending", color: "#D97706", dot: "#F59E0B" };
    case "resolved":
      return { label: "Resolved", color: "#2563EB", dot: "#3B82F6" };
    case "closed":
      return { label: "Closed", color: "#64748B", dot: "#94A3B8" };
    case "archived":
      return { label: "Archived", color: "#64748B", dot: "#94A3B8" };
    default:
      return { label: "Active", color: "#059669", dot: "#22C55E" };
  }
}

// ---------------------------------------------------------------------------
// Chat colour tokens derived from the app theme (ThemeContext)
// ---------------------------------------------------------------------------
export function getChatColors(colors, scheme) {
  const dark = scheme === "dark";
  return {
    ...colors,
    accent: "#0A7CFF",
    accentDark: "#0064E0",
    accentSoft: dark ? "rgba(10,124,255,0.16)" : "rgba(10,124,255,0.10)",
    sentText: "#FFFFFF",
    sentMeta: "rgba(255,255,255,0.72)",
    receivedBg: dark ? "#283039" : "#F0F2F5",
    receivedText: colors.text,
    receivedMeta: colors.textMuted,
    online: "#31A24C",
    unread: "#0A7CFF",
    divider: colors.border,
    skeletonBase: dark ? "#1E293B" : "#E2E8F0",
    skeletonHighlight: dark ? "#334155" : "#EEF2F7",
    chatBg: dark ? "#07111F" : "#FFFFFF",
    inputBar: dark ? "#111C2D" : "#F0F2F5",
  };
}

// ---------------------------------------------------------------------------
// Message list transformation: inserts day dividers and marks grouping so we
// can render Messenger-style stacked bubbles.
// ---------------------------------------------------------------------------
const GROUP_WINDOW_MS = 4 * 60 * 1000; // 4 minutes

export function buildMessageItems(messages = [], myUid) {
  const items = [];
  let lastDay = null;
  let lastSeenMineId = null;
  let lastMineId = null;

  const normalizedMyUid = String(myUid || "").trim();
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const isCallMessage = String(msg.type || "").trim().toLowerCase() === "call";
    const callerId = String(msg.callerId || "").trim();
    const senderId = String(msg.senderId || "").trim();
    const ownerId = isCallMessage ? callerId || senderId : senderId;
    const mine = ownerId === normalizedMyUid;

    if (!lastDay || !isSameDay(msg.createdAt, lastDay)) {
      items.push({
        type: "day",
        id: `day-${msg.id}`,
        label: formatDayDivider(msg.createdAt),
      });
      lastDay = msg.createdAt;
    }

    const prevOwnerId = prev
      ? String(isCallMessage ? prev.callerId || prev.senderId : prev.senderId || "").trim()
      : "";
    const nextOwnerId = next
      ? String(isCallMessage ? next.callerId || next.senderId : next.senderId || "").trim()
      : "";
    const prevSameSender =
      prev &&
      prevOwnerId === ownerId &&
      timeValue(msg.createdAt) - timeValue(prev.createdAt) < GROUP_WINDOW_MS &&
      isSameDay(prev.createdAt, msg.createdAt);
    const nextSameSender =
      next &&
      nextOwnerId === ownerId &&
      timeValue(next.createdAt) - timeValue(msg.createdAt) < GROUP_WINDOW_MS &&
      isSameDay(next.createdAt, msg.createdAt);

    const seenByOther =
      msg.readBy &&
      Object.keys(msg.readBy).some((uid) => uid && uid !== myUid);

    if (mine) {
      lastMineId = msg.id;
      if (seenByOther) lastSeenMineId = msg.id;
    }

    items.push({
      type: "message",
      id: msg.id,
      message: msg,
      mine,
      isFirstInGroup: !prevSameSender,
      isLastInGroup: !nextSameSender,
      seenByOther,
    });
  }

  return { items, lastSeenMineId, lastMineId };
}
