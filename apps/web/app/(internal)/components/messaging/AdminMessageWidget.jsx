import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faCommentDots } from "@fortawesome/free-solid-svg-icons";

export default function AdminMessagesWidget() {
  // Mock data - replace with Firestore listener later
  const messages = [
    {
      id: 1,
      user: "Driver John",
      text: "Can I request a leave for tomorrow?",
      time: "10m ago",
    },
    {
      id: 2,
      user: "System",
      text: "Backup completed successfully.",
      time: "1h ago",
    },
    {
      id: 3,
      user: "Manager Ace",
      text: "Please review the new manifest.",
      time: "2h ago",
    },
  ];

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full shadow-sm">
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center sticky top-0 z-10">
        <h3 className="text-slate-300 font-bold text-sm uppercase flex items-center gap-2">
          <FontAwesomeIcon icon={faEnvelope} className="text-blue-500" />
          Inbox & Messages
        </h3>
        <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-0.5 rounded-full">
          {messages.length} New
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs">
            <FontAwesomeIcon
              icon={faCommentDots}
              className="text-2xl mb-2 opacity-20"
            />
            No new messages
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-colors cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-slate-200 text-xs">
                  {msg.user}
                </span>
                <span className="text-[10px] text-slate-500">{msg.time}</span>
              </div>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 line-clamp-2">
                {msg.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
