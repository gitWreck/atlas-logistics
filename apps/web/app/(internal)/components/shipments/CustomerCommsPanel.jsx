"use client";

import React, { useCallback, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faVideo,
  faMobileScreen,
  faCommentDots,
  faSpinner,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import {
  getCustomerContactForShipment,
  getOrCreateShipmentConversation,
  startConversationCall,
} from "@/app/utility/FirebaseFunctions";
import { getWidgetThemeClasses } from "@/app/utility/constant/theme";

function cleanErrorMessage(error, fallback) {
  const raw = String(error?.message || "")
    .replace(/^Firebase:\s*/i, "")
    .replace(/^\[functions\/[\w-]+\]\s*/i, "")
    .trim();
  return raw || fallback;
}

/**
 * Admin/Manager customer communication panel for shipment details.
 * Spec §5–6, §15: Choose Call Method (Atlas Voice / Video / Cell Phone)
 * and Message (opens/creates shipment conversation).
 */
export default function CustomerCommsPanel({
  shipment,
  isDark = false,
  onOpenChat = null,
}) {
  const theme = getWidgetThemeClasses(isDark);
  const [busy, setBusy] = useState(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const [phoneChoice, setPhoneChoice] = useState(null);

  const shipmentId = shipment?.id || shipment?.shipmentId;

  const ensureConversation = useCallback(async () => {
    const res = await getOrCreateShipmentConversation({ shipmentId });
    const conversationId = res?.data?.conversationId;
    if (!conversationId) {
      throw new Error("Conversation could not be opened.");
    }
    return String(conversationId);
  }, [shipmentId]);

  const startAtlasCall = useCallback(
    async (callType) => {
      setMethodOpen(false);
      if (busy) return;
      setBusy("call");
      try {
        const conversationId = await ensureConversation();
        await startConversationCall({ conversationId, callType });
      } catch (error) {
        console.error("Atlas call failed:", error);
        alert(
          cleanErrorMessage(
            error,
            "Unable to start the call. The customer may need an Atlas account — try Cell Phone Call instead.",
          ),
        );
      } finally {
        setBusy(null);
      }
    },
    [busy, ensureConversation],
  );

  const handleCellPhone = useCallback(async () => {
    setMethodOpen(false);
    if (busy) return;
    setBusy("cell");
    try {
      const res = await getCustomerContactForShipment({ shipmentId });
      const primaryPhone = res?.data?.primaryPhone || null;
      const secondaryPhone = res?.data?.secondaryPhone || null;

      // Secondary is optional: only prompt when both numbers exist.
      if (primaryPhone && secondaryPhone) {
        setPhoneChoice({ primaryPhone, secondaryPhone });
      } else {
        const number = primaryPhone || secondaryPhone;
        if (!number) throw new Error("No phone number is on file.");
        window.location.href = `tel:${number}`;
      }
    } catch (error) {
      console.error("Get customer contact failed:", error);
      alert(
        cleanErrorMessage(error, "You are not allowed to call this customer."),
      );
    } finally {
      setBusy(null);
    }
  }, [busy, shipmentId]);

  const handleMessage = useCallback(async () => {
    if (busy) return;
    setBusy("message");
    try {
      const conversationId = await ensureConversation();
      if (typeof onOpenChat === "function") {
        onOpenChat(conversationId);
      } else {
        alert(
          "Conversation ready. Open the Chat tab to continue messaging the customer.",
        );
      }
    } catch (error) {
      console.error("Open chat failed:", error);
      alert(
        cleanErrorMessage(
          error,
          "Unable to open chat. The customer may need an Atlas account.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensureConversation, onOpenChat]);

  if (!shipmentId) return null;

  const optionClass = `w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-colors ${
    isDark
      ? "hover:bg-slate-800 text-slate-200"
      : "hover:bg-slate-100 text-slate-800"
  }`;

  return (
    <div className={`border rounded-xl p-5 shadow-lg ${theme.container}`}>
      <h3
        className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.title}`}
      >
        <FontAwesomeIcon icon={faPhone} className="text-teal-500" />
        Contact Customer
      </h3>

      <p className={`text-xs mb-4 ${theme.bodyText}`}>
        Atlas Voice, Video, Chat, or Cell Phone — employee numbers stay private.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMethodOpen(true)}
          disabled={!!busy}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${
            isDark
              ? "bg-teal-950/60 border border-teal-700/50 text-teal-300 hover:bg-teal-900/60"
              : "bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100"
          }`}
        >
          {busy === "call" || busy === "cell" ? (
            <FontAwesomeIcon icon={faSpinner} spin />
          ) : (
            <FontAwesomeIcon icon={faPhone} />
          )}
          Call
        </button>

        <button
          type="button"
          onClick={handleMessage}
          disabled={!!busy}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${
            isDark
              ? "bg-blue-950/60 border border-blue-700/50 text-blue-300 hover:bg-blue-900/60"
              : "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
          }`}
        >
          {busy === "message" ? (
            <FontAwesomeIcon icon={faSpinner} spin />
          ) : (
            <FontAwesomeIcon icon={faCommentDots} />
          )}
          Message
        </button>
      </div>

      {methodOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 p-4"
          onClick={() => setMethodOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-4 shadow-2xl ${
              isDark ? "bg-slate-900 border border-slate-700" : "bg-white"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h4
                className={`text-xs font-bold uppercase tracking-wider ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Choose Call Method
              </h4>
              <button
                type="button"
                onClick={() => setMethodOpen(false)}
                className={isDark ? "text-slate-500" : "text-slate-400"}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <button
              type="button"
              className={optionClass}
              onClick={() => startAtlasCall("voice")}
            >
              <FontAwesomeIcon icon={faPhone} className="text-teal-500 w-5" />
              Atlas Voice Call
            </button>
            <button
              type="button"
              className={optionClass}
              onClick={() => startAtlasCall("video")}
            >
              <FontAwesomeIcon icon={faVideo} className="text-violet-500 w-5" />
              Atlas Video Call
            </button>
            <button
              type="button"
              className={optionClass}
              onClick={handleCellPhone}
            >
              <FontAwesomeIcon
                icon={faMobileScreen}
                className="text-blue-500 w-5"
              />
              Cell Phone Call
            </button>
            <button
              type="button"
              className={optionClass}
              onClick={() => setMethodOpen(false)}
            >
              <FontAwesomeIcon
                icon={faTimes}
                className={`w-5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
              />
              Cancel
            </button>
          </div>
        </div>
      )}

      {phoneChoice && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 p-4"
          onClick={() => setPhoneChoice(null)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-4 shadow-2xl ${
              isDark ? "bg-slate-900 border border-slate-700" : "bg-white"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h4
              className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Choose Phone Number
            </h4>

            <button
              type="button"
              className={optionClass}
              onClick={() => {
                const number = phoneChoice.primaryPhone;
                setPhoneChoice(null);
                window.location.href = `tel:${number}`;
              }}
            >
              <FontAwesomeIcon icon={faPhone} className="text-teal-500 w-5" />
              <span>
                <span className="block font-semibold">Primary</span>
                <span
                  className={`block text-xs font-mono ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {phoneChoice.primaryPhone}
                </span>
              </span>
            </button>

            {!!phoneChoice.secondaryPhone && (
              <button
                type="button"
                className={optionClass}
                onClick={() => {
                  const number = phoneChoice.secondaryPhone;
                  setPhoneChoice(null);
                  window.location.href = `tel:${number}`;
                }}
              >
                <FontAwesomeIcon icon={faPhone} className="text-teal-500 w-5" />
                <span>
                  <span className="block font-semibold">Secondary</span>
                  <span
                    className={`block text-xs font-mono ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {phoneChoice.secondaryPhone}
                  </span>
                </span>
              </button>
            )}

            <button
              type="button"
              className={optionClass}
              onClick={() => setPhoneChoice(null)}
            >
              <FontAwesomeIcon
                icon={faTimes}
                className={`w-5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
              />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
