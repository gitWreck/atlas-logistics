"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  collection,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  createConversation,
  markConversationRead,
  sendChatMessage,
} from "@/app/utility/FirebaseFunctions";
import GuestChatWidget from "./GuestChatWidget";

const GuestChatContext = createContext(null);

export function useGuestChat() {
  const context = useContext(GuestChatContext);
  if (!context) {
    throw new Error("useGuestChat must be used within GuestChatProvider");
  }
  return context;
}

async function ensureChatSession() {
  // Wait for logout/login to settle so we don't reuse a stale signed-in token.
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }

  let user = auth.currentUser;

  // Public live chat must run as Firebase anonymous after logout.
  // A previous email/password session has a users/{uid} profile requirement
  // on some callables; anonymous guests intentionally do not.
  if (!user) {
    const credential = await signInAnonymously(auth);
    user = credential.user;
  }

  // Make sure callable + Firestore get a fresh token (anonymous claim included).
  await user.getIdToken(true);
  return user.uid;
}

async function findOpenWebChatConversation(uid) {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "conversations"),
        where("customerId", "==", uid),
        orderBy("lastMessageAt", "desc"),
        limit(10),
      ),
    );

    const match = snapshot.docs.find((doc) => {
      const data = doc.data() || {};
      const status = String(data.status || "open").toLowerCase();
      if (status === "closed") return false;
      if (data.type === "guest_support") return true;
      return data.type === "customer_support" && !data.trackingNumber;
    });

    return match?.id || null;
  } catch (error) {
    // Permission denied after logout is common while rules/session settle —
    // first send still recovers via createConversation (admin SDK).
    if (error?.code !== "permission-denied") {
      console.warn("Could not load existing chat conversation:", error);
    }
    return null;
  }
}

export function GuestChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [chatUid, setChatUid] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const initRef = useRef(false);
  const chatUidRef = useRef(null);

  const resetChatSession = useCallback(() => {
    initRef.current = false;
    chatUidRef.current = null;
    setChatUid(null);
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setErrorMessage("");
  }, []);

  // Keep chat session tied to the current auth user (logout / login swap).
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      const nextUid = user?.uid || null;
      const previousUid = chatUidRef.current;

      if (!nextUid) {
        resetChatSession();
        return;
      }

      if (previousUid && previousUid !== nextUid) {
        resetChatSession();
      }
    });
  }, [resetChatSession]);

  const openChat = useCallback(async () => {
    setIsOpen(true);
    setErrorMessage("");

    const currentUid = auth.currentUser?.uid || null;
    if (initRef.current && chatUidRef.current && currentUid === chatUidRef.current) {
      return;
    }

    setLoading(true);

    try {
      const uid = await ensureChatSession();

      if (chatUidRef.current && chatUidRef.current !== uid) {
        setConversationId(null);
        setMessages([]);
      }

      chatUidRef.current = uid;
      setChatUid(uid);

      const existingId = await findOpenWebChatConversation(uid);
      setConversationId(existingId);
      initRef.current = true;

      if (existingId) {
        markConversationRead({ conversationId: existingId }).catch(() => {});
      }
    } catch (error) {
      console.error("Failed to start live chat:", error);
      initRef.current = false;
      setErrorMessage("Unable to start chat right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!conversationId || !isOpen || !uid || uid !== chatUid) {
      if (!conversationId || !isOpen) {
        setMessages([]);
      }
      return undefined;
    }

    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(200),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        setMessages(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })),
        );
        markConversationRead({ conversationId }).catch(() => {});
      },
      (error) => {
        if (error?.code === "permission-denied") {
          console.error("Live chat messages permission denied:", error);
          setErrorMessage(
            "Unable to load messages (permission denied). Please refresh and try again.",
          );
          return;
        }
        console.error("Live chat messages subscription error:", error);
        setErrorMessage("Unable to load messages. Please refresh and try again.");
      },
    );
  }, [chatUid, conversationId, isOpen]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;

    try {
      setSending(true);
      setErrorMessage("");

      const uid = await ensureChatSession();
      chatUidRef.current = uid;
      setChatUid(uid);

      if (!conversationId) {
        const result = await createConversation({
          message: text,
          source: "web",
        });
        const nextConversationId = result?.data?.conversationId;
        const reused = result?.data?.reused;

        if (!nextConversationId) {
          throw new Error("Conversation was not created.");
        }

        if (reused) {
          await sendChatMessage({ conversationId: nextConversationId, text });
        }

        setConversationId(nextConversationId);
        initRef.current = true;
      } else {
        await sendChatMessage({ conversationId, text });
      }

      setDraft("");
    } catch (error) {
      console.error("Failed to send live chat message:", error);
      const details = String(error?.message || error?.code || "").trim();
      setErrorMessage(
        details
          ? `Message failed to send: ${details}`
          : "Message failed to send. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }, [conversationId, draft, sending]);

  const value = useMemo(
    () => ({
      isOpen,
      openChat,
      closeChat,
    }),
    [closeChat, isOpen, openChat],
  );

  return (
    <GuestChatContext.Provider value={value}>
      {children}
      <GuestChatWidget
        isOpen={isOpen}
        onClose={closeChat}
        onOpen={openChat}
        messages={messages}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        sending={sending}
        loading={loading}
        chatUid={chatUid}
        errorMessage={errorMessage}
      />
    </GuestChatContext.Provider>
  );
}
