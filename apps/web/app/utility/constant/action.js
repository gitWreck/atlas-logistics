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
