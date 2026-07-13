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
import { signInAnonymously } from "firebase/auth";
import {
  collection,
  getDocs,
  limit,
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
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }

  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}

async function findOpenWebChatConversation(uid) {
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

  const openChat = useCallback(async () => {
    setIsOpen(true);
    setErrorMessage("");

    if (initRef.current && chatUid) {
      return;
    }

    setLoading(true);

    try {
      const uid = await ensureChatSession();

      if (chatUid && chatUid !== uid) {
        setConversationId(null);
        initRef.current = false;
      }

      setChatUid(uid);

      const existingId = await findOpenWebChatConversation(uid);
      setConversationId(existingId);
      initRef.current = true;

      if (existingId) {
        markConversationRead({ conversationId: existingId }).catch(() => {});
      }
    } catch (error) {
      console.error("Failed to start live chat:", error);
      setErrorMessage("Unable to start chat right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [chatUid]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!conversationId || !isOpen) {
      setMessages([]);
      return undefined;
    }

    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc"),
      limit(200),
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
        console.error("Live chat messages subscription error:", error);
        setErrorMessage("Unable to load messages. Please refresh and try again.");
      },
    );
  }, [conversationId, isOpen]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;

    try {
      setSending(true);
      setErrorMessage("");

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
      } else {
        await sendChatMessage({ conversationId, text });
      }

      setDraft("");
    } catch (error) {
      console.error("Failed to send live chat message:", error);
      setErrorMessage("Message failed to send. Please try again.");
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
