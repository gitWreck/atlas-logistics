"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronDown,
  faCircle,
  faPaperPlane,
  faSearch,
  faUserCheck,
  faPhone,
  faVideo,
  faInfoCircle,
  faPenToSquare,
  faPlus,
  faImage,
  faFaceSmile,
  faThumbsUp,
  faUser,
  faBell,
  faCircleCheck,
  faUserPlus,
  faBoxOpen,
  faClockRotateLeft,
  faBoxArchive,
  faTrash,
  faEnvelope,
  faCalendarDays,
  faLocationDot,
  faCheckDouble,
  faXmark,
  faSpinner,
  faPaperclip,
} from "@fortawesome/free-solid-svg-icons";
import { db, storage, auth } from "@/lib/firebase";
import {
  assignConversation,
  markConversationRead,
  sendChatMessage,
  startConversationCall,
  updateConversationStatus,
} from "@/app/utility/FirebaseFunctions";
import { formatFirestoreDate } from "@/app/utility/utilities";
import TrackingResult from "@/app/(public)/components/tracking/TrackingResult";

function getInitials(name = "C") {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function avatarColor(name = "") {
  const palette = [
    "#2563eb", "#7c3aed", "#db2777", "#059669",
    "#d97706", "#0891b2", "#dc2626", "#65a30d",
  ];
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
}

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤩", "🥳", "😅", "😉", "🙂", "🙃", "😴", "😭",
  "😡", "👍", "👎", "👌", "🙏", "👏", "🙌", "💪",
  "🔥", "✨", "⭐", "❤️", "💙", "💚", "💛", "🧡",
  "💜", "🎉", "📦", "🚚", "✅", "❌", "⚠️", "❓",
];

const TEXT_ATTACHMENT_PREFIX = "ATLAS_ATTACHMENT:";

const STATUS_OPTIONS = [
  { id: "open", label: "Open", dot: "bg-emerald-500", text: "text-emerald-600" },
  { id: "pending", label: "Pending", dot: "bg-amber-500", text: "text-amber-600" },
  { id: "resolved", label: "Resolved", dot: "bg-blue-500", text: "text-blue-600" },
  { id: "closed", label: "Closed", dot: "bg-slate-400", text: "text-slate-500" },
];

function getStatusOption(status) {
  return STATUS_OPTIONS.find((s) => s.id === status) || STATUS_OPTIONS[0];
}

const ROLE_LABELS = {
  admin: "Admin",
  manager: "Manager",
  checker: "Checker",
  driver: "Driver",
  customer: "Customer",
};

function getRoleLabel(role) {
  const key = String(role || "").toLowerCase();
  return ROLE_LABELS[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Staff");
}

function staffDisplayName(member = {}) {
  return (
    member.name ||
    member.displayName ||
    member.fullName ||
    member.email ||
    "Staff"
  );
}

function isDirectStaffConversation(conversation = {}) {
  return String(conversation.type || "") === "direct_staff";
}

function getDirectPeer(conversation = {}, uid = "") {
  if (!isDirectStaffConversation(conversation)) return null;
  const peerId = (conversation.participantIds || []).find((id) => id !== uid);
  return peerId ? conversation.participantProfiles?.[peerId] || null : null;
}

function conversationDisplayName(conversation = {}, uid = "") {
  return getDirectPeer(conversation, uid)?.name || conversation.customerName || "Customer";
}

function conversationUnreadCount(conversation = {}, uid = "") {
  return Number(
    conversation.unreadCounts?.[
      isDirectStaffConversation(conversation) ? uid : "staff"
    ] || 0,
  );
}

function conversationFilterStatus(conversation = {}) {
  const status = String(conversation.status || "open").toLowerCase();
  if (isDirectStaffConversation(conversation) && status === "active") return "open";
  return status;
}

function getAddressLine(address = {}) {
  if (!address || typeof address !== "object") return "";
  return [
    address.street,
    address.barangay,
    address.city,
    address.province,
    address.zipCode || address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

const INACTIVE_SHIPMENT_STATUSES = [
  "delivered",
  "completed",
  "cancelled",
  "canceled",
  "returned",
  "failed",
  "closed",
];

function isActiveShipment(status) {
  if (!status) return true;
  return !INACTIVE_SHIPMENT_STATUSES.includes(
    String(status).toLowerCase().replace(/[\s-]/g, "_"),
  );
}

function getShipmentPieces(shipment) {
  if (!shipment) return null;
  return (
    shipment.totals?.totalContentQty ||
    shipment.totals?.totalItems ||
    (Array.isArray(shipment.packages) ? shipment.packages.length : null) ||
    null
  );
}

function getShipmentWeight(shipment) {
  if (!shipment) return null;
  if (shipment.totals?.totalWeight) return Number(shipment.totals.totalWeight);
  if (Array.isArray(shipment.packages)) {
    const sum = shipment.packages.reduce(
      (acc, pkg) => acc + (Number(pkg?.weight) || 0),
      0,
    );
    return sum > 0 ? sum : null;
  }
  return null;
}

function getShipmentLocation(shipment, summary) {
  const recipientAddress = shipment?.recipient?.address;
  if (recipientAddress) {
    const line = [recipientAddress.city, recipientAddress.province]
      .filter(Boolean)
      .join(", ");
    if (line) return line;
  }
  return shipment?.destination || summary?.destination || null;
}

function getEstimatedDelivery(shipment) {
  return (
    shipment?.deliveryWindow ||
    shipment?.estimatedDelivery ||
    shipment?.estimatedArrival ||
    shipment?.eta ||
    shipment?.estimatedArrivalAt ||
    shipment?.arrivalEstimate ||
    shipment?.truckDetails?.estimatedArrival ||
    shipment?.truckDetails?.eta ||
    null
  );
}

function encodeTextAttachment({ url, type, name }) {
  return `${TEXT_ATTACHMENT_PREFIX}${encodeURIComponent(
    JSON.stringify({ url, type, name }),
  )}`;
}

function parseTextAttachment(text = "") {
  const rawText = String(text).trim();
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

function getMessageAttachment(message = {}) {
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

function displayMessagePreview(text = "") {
  const attachment = parseTextAttachment(text);
  if (attachment?.type === "image") return "📷 Photo";
  if (attachment?.type === "file") return `📎 ${attachment.name || "File"}`;
  return text || "Conversation started";
}

function getCallHistoryView(message = {}) {
  const text = String(message.text || "").replace(/ðŸ“ž|📞/g, "").trim();
  const lower = text.toLowerCase();
  const type = String(message.callType || "").toLowerCase() === "video" || lower.includes("video") ? "video" : "voice";
  const durationMatch = text.match(/\b\d{1,2}:\d{2}\b/);
  const seconds = Math.max(0, Number(message.duration || 0));
  const duration = durationMatch?.[0] || (seconds > 0
    ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
    : null);
  let status = "Call ended";
  if (lower.includes("missed") || lower.includes("unanswered") || lower.includes("no answer")) status = "Missed";
  else if (lower.includes("declined")) status = "Declined";
  else if (lower.includes("cancel")) status = "Cancelled";
  else if (lower.includes("ongoing")) status = "Ongoing";
  const exceptional = ["Missed", "Declined", "Cancelled"].includes(status);
  return {
    type,
    duration,
    status,
    exceptional,
    title: exceptional ? `${status} ${type} call` : `${type === "video" ? "Video" : "Voice"} call`,
  };
}

function WebCallHistoryCard({ message, mine, isDark, onCall }) {
  const call = getCallHistoryView(message);
  return (
    <div className="w-[min(17rem,70vw)] space-y-3">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${call.exceptional ? "bg-rose-500 text-white" : mine ? "bg-blue-950/35 text-white" : isDark ? "bg-slate-700 text-slate-100" : "bg-white text-slate-700 shadow-sm"}`}>
          <FontAwesomeIcon icon={call.type === "video" ? faVideo : faPhone} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold capitalize leading-5">{call.title}</p>
          <p className={`mt-0.5 text-xs font-medium ${mine ? "text-blue-100" : isDark ? "text-slate-300" : "text-slate-500"}`}>{call.status}</p>
          {call.duration ? <p className="mt-1.5 text-xs font-bold">Duration {call.duration}</p> : null}
        </div>
      </div>
      {call.exceptional ? (
        <button type="button" onClick={() => onCall(call.type)} className={`flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-extrabold transition ${mine ? "bg-white/15 text-white hover:bg-white/25" : isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-white text-slate-800 shadow-sm hover:bg-slate-50"}`}>
          <FontAwesomeIcon icon={call.type === "video" ? faVideo : faPhone} />
          {mine ? "Call again" : "Call back"}
        </button>
      ) : null}
    </div>
  );
}

function Avatar({ name, photoURL, size = 40, online = false }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {photoURL ? (
        <img src={photoURL} alt={`${name} profile`} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-bold text-white"
          style={{ background: avatarColor(name), fontSize: size * 0.38 }}
        >
          {getInitials(name)}
        </div>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-emerald-500"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}

export default function ChatInbox({ user, profile, isDark = false, onViewCustomers }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState("");
  const [calling, setCalling] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [staffMembers, setStaffMembers] = useState([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [inboxMode, setInboxMode] = useState("chats");

  const role = String(profile?.role || "").toLowerCase();
  const canAssign = role === "admin";
  const [mediaOpen, setMediaOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [activeShipment, setActiveShipment] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyShipments, setHistoryShipments] = useState([]);
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [trackData, setTrackData] = useState(null);
  const listEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiRef = useRef(null);
  const statusMenuRef = useRef(null);
  const assignMenuRef = useRef(null);

  useEffect(() => {
    if (!user?.uid || !profile?.role) return undefined;

    const role = String(profile.role || "").toLowerCase();
    const sources = new Map();
    const publish = () => {
      const merged = new Map();
      sources.forEach((items) => items.forEach((item) => merged.set(item.id, item)));
      const items = [...merged.values()]
        .sort((a, b) => {
          const aTime = a.lastMessageAt?.toMillis?.() ?? 0;
          const bTime = b.lastMessageAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
      setConversations(items);
      setSelectedId((current) => {
        if (current && items.some((item) => item.id === current)) return current;
        return items[0]?.id || null;
      });
    };

    const subscribe = (key, targetQuery) =>
      onSnapshot(
        targetQuery,
        (snapshot) => {
          sources.set(
            key,
            snapshot.docs.map((conversation) => ({
              id: conversation.id,
              ...conversation.data(),
            })),
          );
          publish();
        },
        (error) => console.error(`Chat subscription failed (${key}):`, error),
      );

    const unsubscribers = [];
    if (role === "employee" || role === "manager") {
      unsubscribers.push(
        subscribe(
          "assigned",
          query(
            collection(db, "conversations"),
            where("assignedTo", "==", user.uid),
            limit(100),
          ),
        ),
        subscribe(
          "direct",
          query(
            collection(db, "conversations"),
            where("participantIds", "array-contains", user.uid),
            limit(100),
          ),
        ),
      );
    } else if (role === "customer") {
      unsubscribers.push(
        subscribe(
          "customer",
          query(
            collection(db, "conversations"),
            where("customerId", "==", user.uid),
            limit(100),
          ),
        ),
      );
    } else {
      unsubscribers.push(
        subscribe(
          "all",
          query(
            collection(db, "conversations"),
            orderBy("lastMessageAt", "desc"),
            limit(100),
          ),
        ),
      );
    }

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [profile?.role, user?.uid]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return undefined;
    }

    markConversationRead({ conversationId: selectedId }).catch(() => {});

    const q = query(
      collection(db, "conversations", selectedId, "messages"),
      orderBy("createdAt", "desc"),
      limit(200),
    );

    return onSnapshot(q, (snapshot) => {
      setMessages(
        snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .reverse(),
      );
    });
  }, [selectedId]);

  // Drop any staged attachment when switching conversations.
  useEffect(() => {
    setPendingFile((prev) => {
      if (prev) setPendingPreview("");
      return null;
    });
  }, [selectedId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedId]);

  // Show details inline on large screens by default; keep it closed (as an
  // overlay) on smaller screens until the info button is tapped.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowDetails(window.matchMedia("(min-width: 1280px)").matches);
  }, []);

  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedId) || null,
    [conversations, selectedId],
  );
  const selectedDirectPeer = useMemo(
    () => getDirectPeer(selected || {}, user?.uid),
    [selected, user?.uid],
  );
  const selectedName = conversationDisplayName(selected || {}, user?.uid);
  const selectedIsDirect = isDirectStaffConversation(selected || {});

  const assignedMember = useMemo(
    () =>
      selected?.assignedTo
        ? staffMembers.find((member) => member.id === selected.assignedTo) || null
        : null,
    [staffMembers, selected?.assignedTo],
  );

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations.filter((item) => {
      if (inboxMode === "calls" && !isDirectStaffConversation(item)) return false;
      const status = conversationFilterStatus(item);
      const unread = conversationUnreadCount(item, user?.uid);
      let matchesFilter = true;
      if (statusFilter === "all") matchesFilter = status !== "closed";
      else if (statusFilter === "unread") matchesFilter = unread > 0 && status !== "closed";
      else if (statusFilter === "open") matchesFilter = status === "open";
      else if (statusFilter === "archived")
        matchesFilter = status === "closed";
      const haystack = [
        conversationDisplayName(item, user?.uid),
        getDirectPeer(item, user?.uid)?.roleLabel,
        getDirectPeer(item, user?.uid)?.municipality,
        item.customerPhone,
        item.trackingNumber,
        displayMessagePreview(item.lastMessageText),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!term || haystack.includes(term));
    });
  }, [conversations, inboxMode, search, statusFilter, user?.uid]);

  const sharedPhotos = useMemo(
    () =>
      messages
        .map(getMessageAttachment)
        .filter((att) => att?.type === "image")
        .map((att) => att.url)
        .reverse(),
    [messages],
  );

  const unreadTotal = conversations.reduce(
    (sum, item) => sum + conversationUnreadCount(item, user?.uid),
    0,
  );

  const filteredStaffMembers = useMemo(() => {
    const term = assignSearch.trim().toLowerCase();
    if (!term) return staffMembers;
    return staffMembers.filter((member) => {
      const name = staffDisplayName(member).toLowerCase();
      const email = String(member.email || "").toLowerCase();
      const roleLabel = getRoleLabel(member.role).toLowerCase();
      return (
        name.includes(term) ||
        email.includes(term) ||
        roleLabel.includes(term)
      );
    });
  }, [assignSearch, staffMembers]);

  useEffect(() => {
    if (!assignMenuOpen) {
      setAssignSearch("");
    }
  }, [assignMenuOpen]);

  useEffect(() => {
    if (!statusMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [statusMenuOpen]);

  useEffect(() => {
    setStatusMenuOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!assignMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (assignMenuRef.current && !assignMenuRef.current.contains(event.target)) {
        setAssignMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [assignMenuOpen]);

  useEffect(() => {
    setAssignMenuOpen(false);
  }, [selectedId]);

  // Load staff that a conversation can be assigned to.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "users"), where("role", "in", ["employee", "manager", "admin"])),
        );
        const members = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((member) => member.active !== false && member.status !== "inactive")
          .sort((a, b) =>
            staffDisplayName(a).localeCompare(staffDisplayName(b)),
          );
        if (active) setStaffMembers(members);
      } catch (err) {
        console.error("Failed to load staff for assignment:", err);
        if (active) setStaffMembers([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!emojiOpen) return undefined;
    const handleClickOutside = (event) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiOpen]);

  useEffect(() => {
    const selectedConv = conversations.find((c) => c.id === selectedId);
    const customerId = selectedConv?.customerId;
    if (!customerId) {
      setCustomerProfile(null);
      return;
    }
    let active = true;
    getDoc(doc(db, "users", customerId))
      .then((snap) => {
        if (active) setCustomerProfile(snap.exists() ? snap.data() : null);
      })
      .catch(() => {
        if (active) setCustomerProfile(null);
      });
    return () => {
      active = false;
    };
  }, [selectedId, conversations]);

  useEffect(() => {
    const selectedConv = conversations.find((c) => c.id === selectedId);
    const trackingNumber = selectedConv?.trackingNumber;
    if (!trackingNumber) {
      setActiveShipment(null);
      return;
    }
    let active = true;
    getDoc(doc(db, "shipments", trackingNumber))
      .then((snap) => {
        if (active) setActiveShipment(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      })
      .catch(() => {
        if (active) setActiveShipment(null);
      });
    return () => {
      active = false;
    };
  }, [selectedId, conversations]);

  const handleSend = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!selectedId || sending || uploading) return;
    if (!text && !pendingFile) return;

    try {
      setSending(true);

      // Upload and send the staged attachment first (if any).
      if (pendingFile) {
        const file = pendingFile;
        const isImage = file.type.startsWith("image/");
        setUploading(true);
        try {
          const storageRef = ref(
            storage,
            `chat/${selectedId}/${Date.now()}_${file.name}`,
          );
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          await sendChatMessage({
            conversationId: selectedId,
            text: isImage
              ? encodeTextAttachment({ url, type: "image", name: file.name })
              : `File: ${file.name}\n${url}`,
            attachmentUrl: url,
            attachmentType: isImage ? "image" : "file",
            attachmentName: file.name,
          });
        } finally {
          setUploading(false);
        }
        clearPendingFile();
      }

      if (text) {
        await sendChatMessage({ conversationId: selectedId, text });
        setDraft("");
      }
    } catch (err) {
      console.error("Send failed:", err);
      alert("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleSendLike = async () => {
    if (!selectedId || sending || uploading || selected?.status === "closed") return;
    try {
      setSending(true);
      await sendChatMessage({ conversationId: selectedId, text: "👍" });
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
    }
  };

  const handleSelectEmoji = (emoji) => {
    setDraft((prev) => prev + emoji);
    setEmojiOpen(false);
  };

  const handleStatus = async (status) => {
    if (!selectedId) return;
    setStatusMenuOpen(false);
    await updateConversationStatus({ conversationId: selectedId, status });
  };

  const handleTrackShipment = async (trackingNumberArg) => {
    const tn = trackingNumberArg || selected?.trackingNumber;
    if (!tn) return;
    setTrackOpen(true);
    setTrackLoading(true);
    setTrackError("");
    setTrackData(null);
    try {
      const snap = await getDoc(doc(db, "tracking_public", String(tn)));
      if (!snap.exists()) {
        setTrackError("Shipment not found. Please check the tracking number.");
      } else {
        setTrackData({ id: snap.id, ...snap.data() });
      }
    } catch (err) {
      setTrackError("Unable to load tracking details. Please try again.");
    } finally {
      setTrackLoading(false);
    }
  };

  const handleViewCustomerHistory = async () => {
    const customerId = selected?.customerId;
    if (!customerId) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError("");
    setHistoryShipments([]);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(
        `/api/customers/${encodeURIComponent(customerId)}/shipments`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load shipment history.");
      }
      setHistoryShipments(Array.isArray(data.shipments) ? data.shipments : []);
    } catch (err) {
      setHistoryError(err.message || "Failed to load shipment history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAssign = async (assigneeId) => {
    if (!canAssign) {
      alert("Only admins can assign conversations.");
      return;
    }
    if (!selectedId || assigning) return;
    setAssignMenuOpen(false);
    try {
      setAssigning(true);
      await assignConversation({
        conversationId: selectedId,
        assigneeId: assigneeId || "",
      });
    } catch (err) {
      console.error("Assign failed:", err);
      alert("Failed to update assignment. Please try again.");
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignToMe = () => handleAssign(user?.uid);

  const handleStartCall = async (callType = "voice", conversationId = selectedId) => {
    const target = conversations.find((item) => item.id === conversationId);
    if (!conversationId || calling || target?.status === "closed") return;
    try {
      setCalling(true);
      await startConversationCall({
        conversationId,
        callType,
      });
    } catch (err) {
      console.error("Call failed:", err);
      alert(
        err?.message ||
          `Unable to start the ${callType === "video" ? "video" : "voice"} call.`,
      );
    } finally {
      setCalling(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedId) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be under 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    // Stage the file for preview; it is uploaded when the user hits send.
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(
      file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearPendingFile = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview("");
  };

  const surface = isDark
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-50 text-slate-950";
  const panel = isDark
    ? "bg-slate-900 border-slate-800"
    : "bg-white border-slate-200";
  const muted = isDark ? "text-slate-400" : "text-slate-500";
  const chatBg = isDark ? "bg-slate-950" : "bg-white";

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "open", label: "Open" },
    { id: "archived", label: "Archived" },
  ];

  return (
    <div className={`h-full min-h-0 ${surface}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleFileUpload}
      />
      <div
        className={`grid h-full grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] ${
          showDetails ? "xl:grid-cols-[340px_minmax(0,1fr)_320px]" : ""
        }`}
      >
        {/* ───────────── LEFT: Chats ───────────── */}
        <aside
          className={`min-h-0 flex-col border-r ${panel} ${
            mobileThreadOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold tracking-tight">{inboxMode === "calls" ? "Calls" : "Chats"}</h2>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-blue-600 transition hover:bg-blue-50"
                aria-label="New message"
              >
                <FontAwesomeIcon icon={faPenToSquare} />
              </button>
            </div>

            <div
              className={`mt-4 flex h-10 items-center gap-2 rounded-full px-4 ${
                isDark ? "bg-slate-800" : "bg-slate-100"
              }`}
            >
              <FontAwesomeIcon icon={faSearch} className={muted} size="sm" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                placeholder={inboxMode === "calls" ? "Search people, roles or locations" : "Search Messenger"}
              />
            </div>

            <div className={`mt-3 grid grid-cols-2 rounded-xl p-1 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
              {[{ id: "chats", label: "Chats" }, { id: "calls", label: "Calls" }].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setInboxMode(mode.id)}
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                    inboxMode === mode.id
                      ? isDark ? "bg-slate-700 text-white shadow" : "bg-white text-blue-600 shadow-sm"
                      : muted
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className={`${inboxMode === "calls" ? "hidden" : "mt-3 flex flex-wrap gap-2"}`}>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    statusFilter === f.id
                      ? "bg-blue-100 text-blue-600"
                      : isDark
                        ? "bg-slate-800 text-slate-300"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {inboxMode === "calls" && filteredConversations.length > 0 && (
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <p className="text-xs font-extrabold uppercase tracking-wider">Recent calls</p>
                <p className={`text-[11px] ${muted}`}>Authorized contacts</p>
              </div>
            )}
            {filteredConversations.length === 0 ? (
              <div className={`p-6 text-center text-sm ${muted}`}>
                No conversations found.
              </div>
            ) : (
              filteredConversations.map((item) => {
                const isSelected = item.id === selectedId;
                const unread = conversationUnreadCount(item, user?.uid);
                const peer = getDirectPeer(item, user?.uid);
                const displayName = conversationDisplayName(item, user?.uid);
                const isOnline = isDirectStaffConversation(item)
                  ? !!peer?.online
                  : String(item.status || "").toLowerCase() === "open";

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setMobileThreadOpen(true);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        setSelectedId(item.id);
                        setMobileThreadOpen(true);
                      }
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition ${
                      isSelected
                        ? isDark
                          ? "bg-slate-800"
                          : "bg-blue-50"
                        : isDark
                          ? "hover:bg-slate-800/60"
                          : "hover:bg-slate-100"
                    }`}
                  >
                    <Avatar name={displayName} photoURL={peer?.photoURL} size={52} online={isOnline} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">
                          {displayName}
                        </p>
                        <span className={`shrink-0 text-[11px] ${muted}`}>
                          {formatFirestoreDate(item.lastMessageAt) || ""}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-xs ${
                            unread > 0 ? "font-semibold text-current" : muted
                          }`}
                        >
                          {inboxMode === "calls"
                            ? [peer?.roleLabel || "Atlas staff", peer?.municipality || peer?.warehouseName].filter(Boolean).join(" · ")
                            : displayMessagePreview(item.lastMessageText)}
                        </p>
                        {unread > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                    {inboxMode === "calls" && role === "manager" && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); void handleStartCall("voice", item.id); }}
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-blue-600 transition ${isDark ? "hover:bg-slate-700" : "hover:bg-blue-100"}`}
                          aria-label={`Voice call ${displayName}`}
                        ><FontAwesomeIcon icon={faPhone} /></button>
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); void handleStartCall("video", item.id); }}
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-blue-600 transition ${isDark ? "hover:bg-slate-700" : "hover:bg-blue-100"}`}
                          aria-label={`Video call ${displayName}`}
                        ><FontAwesomeIcon icon={faVideo} /></button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ───────────── CENTER: Chat ───────────── */}
        <section
          className={`min-h-0 flex-col ${chatBg} ${
            mobileThreadOpen ? "flex" : "hidden lg:flex"
          }`}
        >
          {selected ? (
            <>
              {/* Header */}
              <div className={`flex items-center justify-between border-b ${panel} px-4 py-3`}>
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileThreadOpen(false)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full lg:hidden ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                    aria-label="Back to conversations"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  <Avatar
                    name={selectedName}
                    photoURL={selectedDirectPeer?.photoURL}
                    size={40}
                    online={selectedIsDirect ? !!selectedDirectPeer?.online : selected.status === "open"}
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold">
                      {selectedName}
                    </h2>
                    <p className={`truncate text-xs ${muted}`}>
                      {selectedIsDirect ? (
                        <span>
                          {[selectedDirectPeer?.roleLabel, selectedDirectPeer?.municipality]
                            .filter(Boolean)
                            .join(" · ") || "Atlas staff"}
                        </span>
                      ) : selected.status === "open" ? (
                        <span className="text-emerald-500">Active now</span>
                      ) : (
                        <span className="capitalize">{selected.status || "open"}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {role === "manager" && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartCall("voice")}
                        disabled={calling || selected?.status === "closed"}
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-60 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                        title="Start voice call"
                      >
                        <FontAwesomeIcon icon={faPhone} className="text-emerald-600" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartCall("video")}
                        disabled={calling || selected?.status === "closed"}
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-60 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                        title="Start video call"
                      >
                        <FontAwesomeIcon icon={faVideo} className="text-blue-600" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                      showDetails
                        ? "bg-blue-100 text-blue-600"
                        : "text-blue-600 hover:bg-blue-50"
                    }`}
                    aria-label="Toggle conversation info"
                    aria-pressed={showDetails}
                  >
                    <FontAwesomeIcon icon={faInfoCircle} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className={`min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-4 ${isDark ? "bg-slate-950" : "bg-white"}`}>
                <div className="flex w-full flex-col gap-1">
                  {messages.map((message, idx) => {
                    const isCallMessage = String(message.type || "").trim().toLowerCase() === "call";
                    const ownerId = isCallMessage
                      ? message.callerId || message.senderId
                      : message.senderId;
                    const mine = ownerId === user?.uid;
                    const attachment = getMessageAttachment(message);
                    const prev = messages[idx - 1];
                    const prevOwnerId = prev
                      ? String(prev.callerId || prev.senderId || "").trim()
                      : "";
                    const showAvatar = !mine && prevOwnerId !== ownerId;
                    return (
                      <div
                        key={message.id}
                        className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                      >
                        {!mine &&
                          (showAvatar ? (
                            <Avatar name={message.senderName} size={28} />
                          ) : (
                            <div className="w-7 shrink-0" />
                          ))}
                        <div className={`flex min-w-0 max-w-[80%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
                          {attachment?.type === "image" ? (
                            <img
                              src={attachment.url}
                              alt={attachment.name || "Photo"}
                              onClick={() => setLightboxUrl(attachment.url)}
                              className="max-h-72 max-w-full cursor-pointer rounded-2xl object-cover"
                            />
                          ) : (
                            <div
                              className={`max-w-full rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                                mine
                                  ? "rounded-br-md bg-blue-600 text-white"
                                  : isDark
                                    ? "rounded-bl-md bg-slate-800 text-slate-100"
                                    : "rounded-bl-md bg-slate-100 text-slate-900"
                              }`}
                            >
                              {isCallMessage ? (
                                <WebCallHistoryCard
                                  message={message}
                                  mine={mine}
                                  isDark={isDark}
                                  onCall={(type) => handleStartCall(type, selectedId)}
                                />
                              ) : (
                                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.text}</p>
                              )}
                            </div>
                          )}
                          <div className={`mt-0.5 flex items-center gap-1 px-1 text-[10px] ${muted}`}>
                            <span>{formatFirestoreDate(message.createdAt) || ""}</span>
                            {mine && <FontAwesomeIcon icon={faCheckDouble} className="text-blue-500" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={listEndRef} />
                </div>
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className={`border-t ${panel} px-3 py-3`}>
                {pendingFile && (
                  <div className="mb-2 flex w-full">
                    <div
                      className={`relative inline-flex items-center gap-2 rounded-2xl border p-2 ${
                        isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-100"
                      }`}
                    >
                      {pendingPreview ? (
                        <img
                          src={pendingPreview}
                          alt={pendingFile.name}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
                          <FontAwesomeIcon icon={faPaperclip} size="lg" />
                        </span>
                      )}
                      <span className="max-w-[160px] truncate pr-5 text-xs">
                        {pendingFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={clearPendingFile}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-white shadow hover:bg-slate-600"
                        aria-label="Remove attachment"
                      >
                        <FontAwesomeIcon icon={faXmark} size="xs" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex w-full items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                    aria-label="Attach file"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                    aria-label="Send photo"
                  >
                    <FontAwesomeIcon icon={faImage} />
                  </button>

                  <div
                    className={`flex flex-1 items-center gap-2 rounded-full px-4 ${
                      isDark ? "bg-slate-800" : "bg-slate-100"
                    }`}
                  >
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
                      placeholder={
                        selected.status === "closed"
                          ? "Conversation is closed"
                          : "Aa"
                      }
                      disabled={selected.status === "closed"}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSend(event);
                        }
                      }}
                    />
                    <div className="relative" ref={emojiRef}>
                      <button
                        type="button"
                        onClick={() => setEmojiOpen((v) => !v)}
                        disabled={selected.status === "closed"}
                        className={`flex items-center justify-center rounded-full transition hover:text-blue-600 disabled:opacity-50 ${muted}`}
                        aria-label="Emoji"
                      >
                        <FontAwesomeIcon icon={faFaceSmile} />
                      </button>
                      {emojiOpen && (
                        <div
                          className={`absolute bottom-10 right-0 z-30 grid w-64 grid-cols-8 gap-1 rounded-2xl border p-2 shadow-xl ${
                            isDark
                              ? "border-slate-700 bg-slate-800"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          {EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleSelectEmoji(emoji)}
                              className="flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-blue-500/10"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {draft.trim() || pendingFile ? (
                    <button
                      type="submit"
                      disabled={sending || uploading || selected.status === "closed"}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                      aria-label="Send message"
                    >
                      <FontAwesomeIcon icon={sending || uploading ? faSpinner : faPaperPlane} spin={sending || uploading} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendLike}
                      disabled={sending || selected.status === "closed"}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                      aria-label="Send like"
                    >
                      <FontAwesomeIcon icon={faThumbsUp} />
                    </button>
                  )}
                </div>
              </form>
            </>
          ) : (
            <div className={`flex flex-1 items-center justify-center ${muted}`}>
              Select a conversation to start replying.
            </div>
          )}
        </section>

        {/* ───────────── RIGHT: Details ───────────── */}
        {showDetails && (
          <div
            className="fixed inset-0 z-40 bg-black/50 xl:hidden"
            onClick={() => setShowDetails(false)}
            aria-hidden="true"
          />
        )}
        <aside
          className={`${showDetails ? "flex" : "hidden"} fixed inset-y-0 right-0 z-40 w-full max-w-sm min-h-0 flex-col overflow-y-auto border-l ${panel} xl:static xl:z-auto xl:w-auto xl:max-w-none ${
            showDetails ? "xl:flex" : ""
          }`}
        >
          <div className="flex items-center justify-end px-3 pt-3 xl:hidden">
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                isDark ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
              }`}
              aria-label="Close details"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
          {selected ? (
            <div className="flex flex-col items-center px-5 py-6">
              <Avatar
                name={selectedName}
                size={80}
                online={selectedIsDirect ? !!selectedDirectPeer?.online : selected.status === "open"}
              />
              <h3 className="mt-3 text-lg font-bold">
                {selectedName}
              </h3>
              <p className={`text-xs ${muted}`}>
                {selectedIsDirect ? (
                  <span>
                    {[selectedDirectPeer?.roleLabel, selectedDirectPeer?.municipality]
                      .filter(Boolean)
                      .join(" · ") || "Atlas staff"}
                  </span>
                ) : selected.status === "open" ? (
                  <span className="text-emerald-500">Active now</span>
                ) : (
                  <span className="capitalize">{selected.status || "open"}</span>
                )}
              </p>

              <div className="mt-6 w-full">
                <p className="mb-3 text-sm font-bold">About</p>
                <div className="flex flex-col gap-3">
                  {(selectedIsDirect
                    ? [
                        {
                          icon: faUser,
                          label: "Role",
                          value: selectedDirectPeer?.roleLabel || getRoleLabel(selectedDirectPeer?.role),
                        },
                        {
                          icon: faLocationDot,
                          label: "Municipality",
                          value: selectedDirectPeer?.municipality || "Warehouse-wide",
                        },
                        {
                          icon: faBoxOpen,
                          label: "Warehouse",
                          value: selectedDirectPeer?.warehouseName || "Assigned warehouse",
                        },
                      ]
                    : [
                    {
                      icon: faPhone,
                      label: "Phone",
                      value:
                        selected.customerPhone ||
                        customerProfile?.phone ||
                        customerProfile?.phoneNumber ||
                        "—",
                    },
                    {
                      icon: faEnvelope,
                      label: "Email",
                      value: customerProfile?.email || selected.customerEmail || "—",
                    },
                    {
                      icon: faCalendarDays,
                      label: "Customer since",
                      value: formatFirestoreDate(selected.createdAt)?.split(",")[0] || "—",
                    },
                    {
                      icon: faLocationDot,
                      label: "Address",
                      value:
                        getAddressLine(customerProfile?.address) ||
                        selected.customerLocation ||
                        "—",
                    },
                  ]).map((row) => (
                    <div key={row.label} className="flex items-start gap-3">
                      <span className={`mt-0.5 ${muted}`}>
                        <FontAwesomeIcon icon={row.icon} size="sm" />
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[11px] ${muted}`}>{row.label}</p>
                        <p className="truncate text-xs font-medium">{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.trackingNumber &&
                isActiveShipment(
                  activeShipment?.status ?? selected.shipmentSummary?.status,
                ) && (
                <div className="mt-6 w-full">
                  <p className="mb-3 text-sm font-bold">Active Shipment</p>
                  <div
                    className={`rounded-xl border p-3 ${
                      isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">#{selected.trackingNumber}</span>
                      {(activeShipment?.status || selected.shipmentSummary?.status) && (
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-blue-600">
                          {String(
                            activeShipment?.status || selected.shipmentSummary?.status,
                          ).replace(/_/g, " ")}
                        </span>
                      )}
                    </div>

                    {getShipmentLocation(activeShipment, selected.shipmentSummary) && (
                      <p className={`mt-1 text-xs ${muted}`}>
                        {getShipmentLocation(activeShipment, selected.shipmentSummary)}
                      </p>
                    )}

                    {(getShipmentPieces(activeShipment) ||
                      getShipmentWeight(activeShipment)) && (
                      <p className={`mt-1 text-xs ${muted}`}>
                        {[
                          getShipmentPieces(activeShipment)
                            ? `${getShipmentPieces(activeShipment)} ${
                                getShipmentPieces(activeShipment) === 1 ? "Piece" : "Pieces"
                              }`
                            : null,
                          getShipmentWeight(activeShipment)
                            ? `${getShipmentWeight(activeShipment)} kg`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" / ")}
                      </p>
                    )}

                    {getEstimatedDelivery(activeShipment) && (
                      <p className={`mt-1 text-xs ${muted}`}>
                        Estimated Delivery:{" "}
                        <span className="font-medium">
                          {typeof getEstimatedDelivery(activeShipment) === "string"
                            ? getEstimatedDelivery(activeShipment)
                            : formatFirestoreDate(getEstimatedDelivery(activeShipment))}
                        </span>
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => handleTrackShipment(selected.trackingNumber)}
                      className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 w-full">
                <p className="mb-3 text-sm font-bold">Quick Actions</p>
                <div className="flex flex-col gap-1">
                  {(["manager", "employee", "admin"].includes(String(profile?.role || "").toLowerCase()) || String(profile?.role || "").toLowerCase() === "staff") && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartCall("voice")}
                        disabled={calling || selected?.status === "closed"}
                        className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition disabled:opacity-60 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                      >
                        <FontAwesomeIcon icon={faPhone} className="text-emerald-600" />
                        Start Voice Call
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartCall("video")}
                        disabled={calling || selected?.status === "closed"}
                        className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition disabled:opacity-60 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                      >
                        <FontAwesomeIcon icon={faVideo} className="text-blue-600" />
                        Start Video Call
                      </button>
                    </>
                  )}
                  {selected.trackingNumber && (
                    <button
                      type="button"
                      onClick={() => handleTrackShipment(selected.trackingNumber)}
                      className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                    >
                      <FontAwesomeIcon icon={faLocationDot} className="text-blue-600" />
                      Track Shipment
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleViewCustomerHistory}
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                  >
                    <FontAwesomeIcon icon={faClockRotateLeft} className="text-blue-600" />
                    View Customer History
                  </button>
                </div>
              </div>

              <div className="mt-6 w-full">
                <p className="mb-3 text-sm font-bold">Assigned To</p>
                {selected.assignedTo ? (
                  <div
                    className={`rounded-xl border p-3 ${
                      isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={selected.assignedToName || staffDisplayName(assignedMember || {})}
                        size={40}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {selected.assignedToName ||
                            staffDisplayName(assignedMember || {})}
                        </p>
                        <p className={`truncate text-xs ${muted}`}>
                          {getRoleLabel(selected.assignedRole || assignedMember?.role)}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`mt-3 space-y-1 border-t pt-3 text-xs ${
                        isDark ? "border-slate-800" : "border-slate-200"
                      }`}
                    >
                      {selected.assignedByName && (
                        <div className="flex items-center justify-between gap-2">
                          <span className={muted}>Assigned By</span>
                          <span className="font-medium">{selected.assignedByName}</span>
                        </div>
                      )}
                      {selected.assignedAt && (
                        <div className="flex items-center justify-between gap-2">
                          <span className={muted}>Assigned Date</span>
                          <span className="font-medium">
                            {formatFirestoreDate(selected.assignedAt)?.split(",")[0] ||
                              formatFirestoreDate(selected.assignedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm ${
                      isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"
                    }`}
                  >
                    <FontAwesomeIcon icon={faUser} className="text-slate-400" />
                    No one is assigned yet.
                  </div>
                )}
              </div>

              <div className="mt-6 w-full">
                <p className="mb-3 text-sm font-bold">Conversation</p>
                <div className="flex flex-col gap-1">
                  <div className="relative" ref={statusMenuRef}>
                    <button
                      type="button"
                      onClick={() => setStatusMenuOpen((open) => !open)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                    >
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${getStatusOption(selected.status).dot}`}
                      />
                      <span className="flex-1 text-left">
                        Status:{" "}
                        <span className={`font-semibold ${getStatusOption(selected.status).text}`}>
                          {getStatusOption(selected.status).label}
                        </span>
                      </span>
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`text-xs transition-transform ${statusMenuOpen ? "rotate-180" : ""} ${muted}`}
                      />
                    </button>
                    {statusMenuOpen && (
                      <div
                        className={`absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border shadow-lg ${
                          isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
                        }`}
                      >
                        {STATUS_OPTIONS.map((option) => {
                          const active = selected.status === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => handleStatus(option.id)}
                              className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition ${
                                isDark ? "hover:bg-slate-700" : "hover:bg-slate-100"
                              } ${active ? (isDark ? "bg-slate-700" : "bg-slate-100") : ""}`}
                            >
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${option.dot}`} />
                              <span className="flex-1 text-left">{option.label}</span>
                              {active && (
                                <FontAwesomeIcon icon={faCircleCheck} className="text-xs text-emerald-500" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {canAssign && (
                    <div className="relative" ref={assignMenuRef}>
                      <button
                        type="button"
                        onClick={() => setAssignMenuOpen((open) => !open)}
                        disabled={assigning}
                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition disabled:opacity-60 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                      >
                        <FontAwesomeIcon
                          icon={assigning ? faSpinner : faUserPlus}
                          className={`text-blue-600 ${assigning ? "animate-spin" : ""}`}
                        />
                        <span className="flex-1 text-left">
                          {selected.assignedTo
                            ? "Reassign Conversation"
                            : "Assign Conversation"}
                        </span>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className={`text-xs transition-transform ${assignMenuOpen ? "rotate-180" : ""} ${muted}`}
                        />
                      </button>
                      {assignMenuOpen && (
                        <div
                          className={`absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border shadow-lg ${
                            isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
                          }`}
                        >
                          {user?.uid && selected.assignedTo !== user.uid && (
                            <button
                              type="button"
                              onClick={() => handleAssignToMe()}
                              className={`flex w-full items-center gap-3 border-b px-3 py-2 text-sm font-medium transition ${
                                isDark
                                  ? "border-slate-700 hover:bg-slate-700"
                                  : "border-slate-100 hover:bg-slate-100"
                              }`}
                            >
                              <FontAwesomeIcon icon={faUserCheck} className="text-blue-600" />
                              Assign to me
                            </button>
                          )}
                          <div className={`px-3 py-3 ${isDark ? "border-b border-slate-700" : "border-b border-slate-100"}`}>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Search users
                            </label>
                            <input
                              value={assignSearch}
                              onChange={(event) => setAssignSearch(event.target.value)}
                              placeholder="Search staff"
                              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                                isDark
                                  ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-blue-500"
                                  : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500"
                              }`}
                            />
                          </div>
                          {staffMembers.length === 0 ? (
                            <p className={`px-3 py-2 text-sm ${muted}`}>No staff available.</p>
                          ) : filteredStaffMembers.length === 0 ? (
                            <p className={`px-3 py-2 text-sm ${muted}`}>No staff matches your search.</p>
                          ) : (
                            filteredStaffMembers.map((member) => {
                              const active = selected.assignedTo === member.id;
                              return (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() => handleAssign(member.id)}
                                  className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-slate-700" : "hover:bg-slate-100"
                                  } ${active ? (isDark ? "bg-slate-700" : "bg-slate-100") : ""}`}
                                >
                                  <Avatar name={staffDisplayName(member)} size={28} />
                                  <span className="min-w-0 flex-1 text-left">
                                    <span className="block truncate font-medium">
                                      {staffDisplayName(member)}
                                      {member.id === user?.uid ? " (You)" : ""}
                                    </span>
                                    <span className={`block truncate text-xs ${muted}`}>
                                      {getRoleLabel(member.role)}
                                    </span>
                                  </span>
                                  {active && (
                                    <FontAwesomeIcon
                                      icon={faCircleCheck}
                                      className="text-xs text-emerald-500"
                                    />
                                  )}
                                </button>
                              );
                            })
                          )}
                          {selected.assignedTo && (
                            <button
                              type="button"
                              onClick={() => handleAssign("")}
                              className={`flex w-full items-center gap-3 border-t px-3 py-2 text-sm font-medium text-red-600 transition ${
                                isDark
                                  ? "border-slate-700 hover:bg-slate-700"
                                  : "border-slate-100 hover:bg-slate-100"
                              }`}
                            >
                              <FontAwesomeIcon icon={faXmark} />
                              Unassign Conversation
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      handleStatus(selected.status === "closed" ? "open" : "closed")
                    }
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                  >
                    <FontAwesomeIcon icon={faBoxArchive} className="text-slate-500" />
                    {selected.status === "closed"
                      ? "Unarchive Conversation"
                      : "Archive Conversation"}
                  </button>
                </div>
              </div>

              {sharedPhotos.length > 0 && (
                <div className="mt-6 w-full">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold">Shared Photos</p>
                    {sharedPhotos.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setMediaOpen(true)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        See all
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {sharedPhotos.slice(0, 6).map((url, i) => (
                      <button
                        key={`${url}-${i}`}
                        type="button"
                        onClick={() => setLightboxUrl(url)}
                        className="relative aspect-square overflow-hidden rounded-lg"
                      >
                        <img src={url} alt="Shared" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`flex flex-1 items-center justify-center ${muted}`}>
              No conversation selected.
            </div>
          )}
        </aside>
      </div>

      {mediaOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setMediaOpen(false)}>
          <div className="flex-1 bg-black/50" />
          <div
            className={`flex h-full w-full max-w-md flex-col shadow-2xl ${
              isDark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center gap-3 border-b px-5 py-4 ${panel}`}>
              <button
                type="button"
                onClick={() => setMediaOpen(false)}
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  isDark ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <div>
                <h3 className="text-base font-bold">Shared Photos</h3>
                <p className={`text-xs ${muted}`}>
                  {sharedPhotos.length} photo{sharedPhotos.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {sharedPhotos.length === 0 ? (
                <div className={`flex h-40 items-center justify-center ${muted}`}>
                  No shared photos yet.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {sharedPhotos.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      type="button"
                      onClick={() => setLightboxUrl(url)}
                      className="aspect-square overflow-hidden rounded-lg"
                    >
                      <img src={url} alt="Shared" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <FontAwesomeIcon icon={faXmark} size="lg" />
          </button>
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {historyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className={`flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-2xl ${
              isDark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`flex items-center justify-between border-b px-5 py-4 ${
                isDark ? "border-slate-700" : "border-slate-200"
              }`}
            >
              <div className="min-w-0">
                <p className="text-base font-bold">Customer History</p>
                <p className={`truncate text-xs ${muted}`}>
                  {selected?.customerName || "Customer"} · Shipments
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                }`}
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {historyLoading ? (
                <div className={`flex flex-col items-center justify-center gap-2 py-12 ${muted}`}>
                  <FontAwesomeIcon icon={faSpinner} spin className="text-xl" />
                  <span className="text-sm">Loading shipments…</span>
                </div>
              ) : historyError ? (
                <div className="py-12 text-center text-sm text-red-500">{historyError}</div>
              ) : historyShipments.length === 0 ? (
                <div className={`py-12 text-center text-sm ${muted}`}>
                  No shipments found for this customer.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {historyShipments.map((shipment, i) => {
                    const tn = shipment.trackingNumber || shipment.id;
                    const route =
                      shipment.route ||
                      [shipment.origin, shipment.destination].filter(Boolean).join(" → ");
                    return (
                      <div
                        key={shipment.id || i}
                        className={`rounded-xl border p-3 ${
                          isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-sm font-bold">{tn || "Shipment"}</span>
                          {shipment.status && (
                            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-blue-600">
                              {String(shipment.status).replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        {route && <p className={`mt-1 text-xs ${muted}`}>{route}</p>}
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`text-[11px] ${muted}`}>
                            {shipment.updatedAt || shipment.createdAt || ""}
                          </span>
                          {tn && (
                            <button
                              type="button"
                              onClick={() => {
                                setHistoryOpen(false);
                                handleTrackShipment(tn);
                              }}
                              className="text-xs font-semibold text-blue-600 hover:underline"
                            >
                              Track
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {trackOpen && (
        <div
          className="fixed inset-0 z-50 flex"
          onClick={() => setTrackOpen(false)}
        >
          <div className="flex-1 bg-black/50" />
          <div
            className={`flex h-full w-full max-w-xl flex-col shadow-2xl ${
              isDark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`flex items-center justify-between border-b px-5 py-4 ${
                isDark ? "border-slate-700" : "border-slate-200"
              }`}
            >
              <div className="min-w-0">
                <p className="text-base font-bold">Track Shipment</p>
                <p className={`truncate text-xs ${muted}`}>
                  {selected?.trackingNumber || ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTrackOpen(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                }`}
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-100">
              {trackLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-500">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-xl" />
                  <span className="text-sm">Loading tracking details…</span>
                </div>
              ) : trackError ? (
                <div className="py-20 text-center text-sm text-red-500">{trackError}</div>
              ) : trackData ? (
                <div>
                  <TrackingResult data={trackData} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
