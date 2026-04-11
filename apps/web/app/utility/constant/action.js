export function getModalActionClasses() {
  return {
    // Primary inline action (e.g. confirm beside cancel)
    primaryInline:
      "flex-1 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-bold transition-colors",

    // Full-width primary action (main submit button)
    primary:
      "w-full py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-bold transition-all disabled:opacity-50",

    // Secondary / cancel button
    secondary:
      "flex-1 px-5 py-2.5 rounded-lg border font-medium transition-colors disabled:opacity-50 text-sm border-slate-200 text-slate-600 hover:bg-slate-50",

    // Danger action (disable / delete)
    danger:
      "flex-1 px-5 py-2.5 rounded-lg text-white shadow-lg flex items-center justify-center gap-2 transition-all font-medium text-sm disabled:opacity-50 bg-red-600 hover:bg-red-500 shadow-red-500/20",

    // Success action (activate / done)
    success:
      "flex-1 px-5 py-2.5 rounded-lg text-white shadow-lg flex items-center justify-center gap-2 transition-all font-medium text-sm disabled:opacity-50 bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20",

    // Full-width success button (e.g. Done)
    successFull:
      "w-full py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold transition-colors",

    // Optional: destructive modal border highlight
    dangerBorder: "border-red-500/30",

    // Optional: success modal border highlight
    successBorder: "border-emerald-500/30",

    warningInline:
      "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 bg-amber-600 text-white hover:bg-amber-500",

    primaryInlineCompact:
      "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 bg-blue-600 text-white hover:bg-blue-500",
  };
}

export function getButtonActionClasses() {
  return {
    idle: {
      blue: "bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border-blue-500/30",
      amber:
        "bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border-amber-500/30",
      emerald:
        "bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border-emerald-500/30",
      red: "bg-red-600/20 hover:bg-red-600/40 text-red-400 border-red-500/30",
    },

    loading:
      "bg-blue-600/10 text-blue-400 border-blue-500/30 cursor-wait opacity-80",
    success:
      "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20",
    error: "bg-red-500 text-white border-red-600",
  };
}

export function getTableActionClasses(isDark) {
  return {
    soft: isDark
      ? "bg-slate-800 hover:bg-slate-700 text-blue-400 border-slate-700"
      : "bg-slate-100 hover:bg-slate-200 text-blue-600 border-slate-300",

    solid:
      "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20",

    dangerSoft: isDark
      ? "bg-slate-800 hover:bg-slate-700 text-red-400 border-slate-700"
      : "bg-slate-100 hover:bg-slate-200 text-red-600 border-slate-300",

    bulkNeutral: isDark
      ? "bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300"
      : "bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-700",

    bulkLoad: "bg-emerald-600 hover:bg-emerald-500 text-white",

    bulkOut: "bg-amber-600 hover:bg-amber-500 text-white",

    bulkDelivered: "bg-purple-600 hover:bg-purple-500 text-white",

    link: "text-xs text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1 px-2 py-1",
  };
}

export function getTimelineActionClasses(isDark) {
  return {
    editButton: isDark
      ? "bg-slate-800 hover:bg-slate-700 text-blue-400 border-slate-700"
      : "bg-slate-100 hover:bg-slate-200 text-blue-600 border-slate-300",

    localBadge: isDark
      ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
      : "bg-amber-100 text-amber-800 border-amber-300",

    transferBadge: isDark
      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
      : "bg-blue-100 text-blue-800 border-blue-300",

    cancelledDot: "border-red-500 bg-red-600 ring-4 ring-red-900/20",

    cancelledTitle: "text-red-500",

    cancelledMeta: "text-red-400",

    doneDot: "bg-emerald-600 border-emerald-600",

    currentRing: "ring-4 ring-emerald-500/20 scale-110",

    currentMeta: "text-[10px] text-emerald-400 mt-0.5 animate-pulse",
  };
}
