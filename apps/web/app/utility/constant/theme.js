// app/utility/dashboardTheme.js

export function getDashboardThemeClasses(isDark) {
  return {
    rootBackground: isDark
      ? "bg-slate-950 text-slate-100"
      : "bg-slate-50 text-slate-900",

    sidebar: isDark
      ? "bg-slate-900 border-slate-800"
      : "bg-white border-slate-200",

    topbar: isDark
      ? "bg-slate-900 border-slate-800"
      : "bg-white border-slate-200",

    sidebarToggle: isDark
      ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-slate-50"
      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900",

    mobileMenuButton: isDark
      ? "border-slate-700 bg-slate-900 text-slate-100"
      : "border-slate-200 bg-white text-slate-700",

    titleText: isDark ? "text-white" : "text-slate-900",

    subtitleText: isDark ? "text-slate-400" : "text-slate-600",

    logoutButton: isDark
      ? "text-slate-300 hover:bg-slate-800"
      : "text-slate-700 hover:bg-slate-100",

    logoutIcon: isDark
      ? "bg-slate-900 text-slate-300"
      : "bg-slate-100 text-slate-600",

    brandLabel: isDark ? "text-slate-400" : "text-slate-600",

    brandTitle: isDark ? "text-white" : "text-slate-900",

    navIdle: isDark
      ? "text-slate-200 hover:bg-slate-800"
      : "text-slate-700 hover:bg-slate-100",

    navIconIdle: isDark
      ? "bg-slate-100/10 text-slate-400"
      : "bg-slate-900/5 text-slate-500",
  };
}

export function getOverviewThemeClasses(isDark) {
  return {
    mutedText: isDark ? "text-slate-500" : "text-slate-600",
    strongText: isDark ? "text-white" : "text-slate-900",

    sectionCard: isDark
      ? "bg-slate-900/50 border-slate-800"
      : "bg-slate-100 border-slate-200",

    analyticsCard: isDark
      ? "border-slate-700 bg-slate-800/50"
      : "border-slate-200 bg-white",

    analyticsLabel: isDark ? "text-slate-400" : "text-slate-500",
    analyticsValue: isDark ? "text-slate-100" : "text-slate-900",

    segmentedControl: isDark
      ? "bg-slate-950 border-slate-800"
      : "bg-slate-200 border-slate-300",

    segmentedControlActive: isDark
      ? "bg-slate-800 text-white shadow-sm border border-slate-700"
      : "bg-white text-slate-900 shadow-sm border border-slate-300",

    segmentedControlIdle: isDark
      ? "text-slate-500 hover:text-slate-300"
      : "text-slate-600 hover:text-slate-900",

    highlightText: "text-blue-500 font-bold uppercase",
  };
}

export function getStatCardTheme(isDark) {
  return {
    indigo: {
      card: isDark
        ? "bg-indigo-950/40 border-indigo-800"
        : "bg-indigo-50 border-indigo-100",
      title: isDark ? "text-indigo-300" : "text-indigo-700",
      value: isDark ? "text-indigo-100" : "text-indigo-900",
      subtitle: isDark ? "text-indigo-400" : "text-indigo-600",
      iconWrap: isDark
        ? "bg-indigo-500/10 text-indigo-300"
        : "bg-indigo-100 text-indigo-600",
    },

    amber: {
      card: isDark
        ? "bg-amber-950/40 border-amber-800"
        : "bg-amber-50 border-amber-100",
      title: isDark ? "text-amber-300" : "text-amber-700",
      value: isDark ? "text-amber-100" : "text-amber-900",
      subtitle: isDark ? "text-amber-400" : "text-amber-600",
      iconWrap: isDark
        ? "bg-amber-500/10 text-amber-300"
        : "bg-amber-100 text-amber-600",
    },

    sky: {
      card: isDark
        ? "bg-sky-950/40 border-sky-800"
        : "bg-sky-50 border-sky-100",
      title: isDark ? "text-sky-300" : "text-sky-700",
      value: isDark ? "text-sky-100" : "text-sky-900",
      subtitle: isDark ? "text-sky-400" : "text-sky-600",
      iconWrap: isDark
        ? "bg-sky-500/10 text-sky-300"
        : "bg-sky-100 text-sky-600",
    },

    emerald: {
      card: isDark
        ? "bg-emerald-950/40 border-emerald-800"
        : "bg-emerald-50 border-emerald-100",
      title: isDark ? "text-emerald-300" : "text-emerald-700",
      value: isDark ? "text-emerald-100" : "text-emerald-900",
      subtitle: isDark ? "text-emerald-400" : "text-emerald-600",
      iconWrap: isDark
        ? "bg-emerald-500/10 text-emerald-300"
        : "bg-emerald-100 text-emerald-600",
    },

    blue: {
      card: isDark
        ? "bg-blue-950/40 border-blue-800"
        : "bg-blue-50 border-blue-100",
      title: isDark ? "text-blue-300" : "text-blue-700",
      value: isDark ? "text-blue-100" : "text-blue-900",
      subtitle: isDark ? "text-blue-400" : "text-blue-600",
      iconWrap: isDark
        ? "bg-blue-500/10 text-blue-300"
        : "bg-blue-100 text-blue-600",
    },

    red: {
      card: isDark
        ? "bg-red-950/40 border-red-800"
        : "bg-red-50 border-red-100",
      title: isDark ? "text-red-300" : "text-red-700",
      value: isDark ? "text-red-100" : "text-red-900",
      subtitle: isDark ? "text-red-400" : "text-red-600",
      iconWrap: isDark
        ? "bg-red-500/10 text-red-300"
        : "bg-red-100 text-red-600",
    },
  };
}

export function getBoardThemeClasses(isDark) {
  return {
    page: isDark ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-900",

    board: isDark
      ? "border-slate-800 bg-slate-900/50"
      : "border-slate-200 bg-white",

    header: isDark
      ? "border-slate-800 bg-slate-950/30"
      : "border-slate-200 bg-slate-50",

    title: isDark ? "text-white" : "text-slate-900",

    mutedText: isDark ? "text-slate-500" : "text-slate-600",

    iconMuted: isDark ? "text-slate-500" : "text-slate-400",

    refreshButton: isDark
      ? "text-slate-500 hover:text-white hover:bg-slate-800"
      : "text-slate-400 hover:text-slate-700 hover:bg-slate-200",

    input: isDark
      ? "bg-slate-900 border-slate-700 text-white"
      : "bg-white border-slate-300 text-slate-900",

    dateInput: isDark
      ? "text-white [color-scheme:dark]"
      : "text-slate-900 [color-scheme:light]",

    filterWrap: isDark
      ? "bg-slate-900 border-slate-700"
      : "bg-white border-slate-300",

    tableHead: isDark
      ? "border-slate-800 bg-slate-950 text-slate-500"
      : "border-slate-200 bg-slate-50 text-slate-700",

    emptyText: isDark ? "text-slate-500" : "text-slate-600",

    footer: isDark
      ? "border-slate-800 bg-slate-950/30"
      : "border-slate-200 bg-slate-50",

    footerText: isDark ? "text-slate-600" : "text-slate-600",

    footerStrong: isDark ? "text-white" : "text-slate-900",

    paginationButton: isDark
      ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
      : "border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100",

    warningFilter: isDark
      ? "bg-slate-900 text-amber-100 border-amber-500/50"
      : "bg-amber-50 text-amber-900 border-amber-500/50",

    warningIcon: "text-amber-500",

    // ----------------------------
    actionButton: isDark
      ? "bg-slate-700 hover:bg-slate-600 text-white"
      : "bg-slate-200 hover:bg-slate-300 text-slate-800",

    contentBoard: isDark
      ? "border-slate-700 bg-slate-900/50"
      : "border-slate-200 bg-white",

    tableHeadSoft: isDark
      ? "bg-slate-900 border-slate-700 text-slate-400"
      : "bg-slate-50 border-slate-200 text-slate-600",

    pageBadge: isDark
      ? "bg-slate-900 border-slate-700 text-slate-300"
      : "bg-slate-50 border-slate-200 text-slate-700",
  };
}

export function getRowThemeClasses(isDark) {
  return {
    rowBorder: isDark ? "border-slate-800/50" : "border-slate-200",

    rowDefaultHover: isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50",

    rowDelayed: isDark
      ? "bg-amber-500/5 hover:bg-amber-500/10"
      : "bg-amber-50 hover:bg-amber-50/80",

    primaryText: isDark ? "text-white" : "text-slate-900",
    secondaryText: isDark ? "text-slate-300" : "text-slate-700",
    mutedText: isDark ? "text-slate-500" : "text-slate-600",
    subtleText: isDark ? "text-slate-600" : "text-slate-500",

    tripIdTextDefault: isDark ? "text-blue-400" : "text-blue-600",
    tripIdTextDelayed: isDark ? "text-amber-400" : "text-amber-700",

    routeArrow: isDark ? "text-slate-600" : "text-slate-500",

    typeBadgeLocal: isDark
      ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
      : "bg-amber-100 text-amber-800 border-amber-300",

    typeBadgeTransfer: isDark
      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
      : "bg-blue-100 text-blue-800 border-blue-300",

    statsDivider: isDark
      ? "text-slate-500 border-slate-700"
      : "text-slate-600 border-slate-300",

    progressTrack: isDark ? "bg-slate-800" : "bg-slate-200",

    progressBlue: "bg-blue-500",
    progressAmber: "bg-amber-500",
    progressEmerald: "bg-emerald-500",

    statusTextDefault: isDark ? "text-blue-400" : "text-blue-600",
    statusTextDelayed: isDark ? "text-amber-400" : "text-amber-700",
    statusTextCompleted: isDark ? "text-emerald-400" : "text-emerald-600",

    delayedPill: isDark
      ? "bg-amber-600 text-white"
      : "bg-amber-100 text-amber-800",

    actionButton: isDark
      ? "text-slate-500 hover:text-white hover:bg-slate-800"
      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",

    tripIdTextShipment: isDark ? "text-blue-400" : "text-blue-600",

    // ----------------------------
    packageIndexBadge: isDark
      ? "bg-slate-800 border-slate-700 text-slate-500 group-hover:bg-slate-700 group-hover:text-white"
      : "bg-slate-100 border-slate-200 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900",

    trackingBadge:
      "font-mono text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded w-fit border border-amber-500/20",

    fragileBadge: isDark
      ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
      : "bg-amber-50 border border-amber-200 text-amber-700",

    perishableBadge: isDark
      ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
      : "bg-cyan-50 border border-cyan-200 text-cyan-700",

    iconActionButton: isDark
      ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
      : "bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-900 border border-slate-300",

    iconActionButtonActive:
      "bg-blue-600 text-white shadow-lg shadow-blue-900/50",

    expandedRow: isDark ? "bg-slate-900/50" : "bg-slate-50",

    expandedCard: isDark
      ? "bg-slate-950 border-slate-800"
      : "bg-white border-slate-200",
  };
}

export function getDrawerThemeClasses(isDark) {
  return {
    overlay: "bg-black/60",

    drawer: isDark
      ? "bg-slate-900 border-l border-slate-800"
      : "bg-white border-l border-slate-200",

    header: isDark
      ? "border-slate-800 bg-slate-950"
      : "border-slate-200 bg-slate-50",

    content: isDark ? "bg-slate-900" : "bg-white",

    footer: isDark
      ? "border-slate-800 bg-slate-950/30"
      : "border-slate-200 bg-slate-50",

    eyebrow: isDark ? "text-emerald-500" : "text-emerald-600",

    title: isDark ? "text-white" : "text-slate-900",

    mutedText: isDark ? "text-slate-400" : "text-slate-600",

    divider: isDark ? "border-slate-700" : "border-slate-300",

    closeButton: isDark
      ? "text-slate-500 hover:text-white hover:bg-slate-800"
      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100",

    tabsWrap: isDark
      ? "border-slate-800 bg-slate-900"
      : "border-slate-200 bg-slate-50",

    tabActive: isDark
      ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
      : "border-emerald-500 text-emerald-600 bg-emerald-50",

    tabIdle: isDark
      ? "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
      : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-100",

    unlockButton:
      "bg-amber-500 text-white px-4 py-2 rounded shadow hover:bg-amber-600 transition-colors",

    // ------------------------------------
    footerPanel: isDark
      ? "border-slate-800 bg-slate-950"
      : "border-slate-200 bg-slate-50",

    reasonBox: isDark
      ? "bg-slate-900 border-slate-800"
      : "bg-white border-slate-200",

    reasonLabel:
      "text-[10px] font-bold uppercase text-amber-500 tracking-wider",

    textarea: isDark
      ? "bg-slate-950 border-slate-800 text-white"
      : "bg-slate-50 border-slate-300 text-slate-900",

    warningOutlineButton:
      "flex-1 py-2 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-600/20 text-xs font-bold disabled:opacity-30 transition-colors flex justify-center items-center gap-2",

    secondaryActionButton: isDark
      ? "flex-1 py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
      : "flex-1 py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300",
  };
}

export function getTableTheme(isDark) {
  return {
    container: isDark
      ? "border-slate-800 bg-slate-900/50"
      : "border-slate-200 bg-white shadow-sm",

    header: isDark
      ? "border-slate-800 bg-slate-950/30"
      : "border-slate-200 bg-slate-50",

    headingText: isDark ? "text-white" : "text-slate-900",

    filters: isDark
      ? "border-slate-800 bg-slate-950/20"
      : "border-slate-200 bg-slate-50/50",

    input: isDark
      ? "bg-slate-900 border-slate-700 text-slate-200"
      : "bg-white border-slate-200 text-slate-900",

    inputIcon: isDark ? "text-slate-500" : "text-slate-400",

    tableText: isDark ? "text-slate-400" : "text-slate-600",

    thead: isDark
      ? "bg-slate-950 text-slate-500"
      : "bg-slate-50 text-slate-600",

    tbodyDivide: isDark ? "divide-slate-800" : "divide-slate-200",

    rowHover: isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50",

    cellPrimary: isDark ? "text-slate-200" : "text-slate-900",

    cellSecondary: isDark ? "text-slate-500" : "text-slate-600",

    roleBadge: isDark
      ? "bg-slate-800 border-slate-700 text-slate-300"
      : "bg-slate-100 border-slate-200 text-slate-700",

    statusActive: isDark
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-emerald-100 text-emerald-700 border-emerald-200",

    statusInactive: isDark
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : "bg-red-100 text-red-700 border-red-200",

    editButton: isDark
      ? "text-slate-500 hover:text-blue-400 hover:bg-slate-800"
      : "text-slate-600 hover:text-blue-600 hover:bg-slate-100",

    deleteButton: isDark
      ? "text-slate-500 hover:text-red-400 hover:bg-slate-800"
      : "text-slate-600 hover:text-red-600 hover:bg-slate-100",

    emptyText: isDark ? "text-slate-600" : "text-slate-500",

    footer: isDark
      ? "border-slate-800 bg-slate-950/30 text-slate-500"
      : "border-slate-200 bg-slate-50 text-slate-600",

    footerBold: isDark ? "text-white" : "text-slate-900",

    paginationButton: isDark
      ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900",

    sectionTitle: isDark ? "text-slate-300" : "text-slate-700",

    miniLabel: isDark ? "text-slate-500" : "text-slate-600",

    selectWrap: isDark
      ? "bg-slate-900 border-slate-700"
      : "bg-white border-slate-300",

    selectText: isDark ? "text-white" : "text-slate-900",

    neutralBadge: isDark
      ? "bg-slate-800 text-slate-400"
      : "bg-slate-100 text-slate-600",

    linkButton:
      "text-xs text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1 px-2 py-1",

    topDivider: isDark ? "border-slate-800/50" : "border-slate-200",

    // added
    statCard: isDark
      ? "bg-slate-800/20 border-slate-800"
      : "bg-slate-50 border-slate-200",

    selectedInfo: isDark
      ? "text-blue-400 bg-blue-900/20 border-blue-500/30"
      : "text-blue-600 bg-blue-50 border-blue-200",

    bulkBar: isDark
      ? "bg-blue-900/20 border-blue-500/30"
      : "bg-blue-50 border-blue-200",

    bulkBarText: isDark ? "text-blue-400" : "text-blue-600",

    stickyHead: isDark ? "bg-slate-950" : "bg-slate-100",

    stickyCell: isDark ? "bg-slate-900/50" : "bg-white",

    stickyCellSelected: isDark ? "bg-blue-900/10" : "bg-blue-50",

    selectedRow: isDark ? "bg-blue-900/10" : "bg-blue-50",

    checkboxIdle: isDark ? "text-slate-700" : "text-slate-400",

    checkboxActive: "text-blue-500",

    actionButtonSoft: isDark
      ? "bg-slate-800 hover:bg-slate-700 text-blue-400 border-slate-700"
      : "bg-slate-100 hover:bg-slate-200 text-blue-600 border-slate-300",

    actionButtonSolid:
      "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20",

    bulkButtonNeutral: isDark
      ? "bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300"
      : "bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-700",

    bulkButtonLoad: "bg-emerald-600 hover:bg-emerald-500 text-white",
    bulkButtonOut: "bg-amber-600 hover:bg-amber-500 text-white",
    bulkButtonDelivered: "bg-purple-600 hover:bg-purple-500 text-white",

    countBadgeLoaded: isDark
      ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/30"
      : "bg-emerald-100 text-emerald-700 border-emerald-300",

    countBadgeDefault: isDark
      ? "bg-slate-800 text-slate-500 border-slate-700"
      : "bg-slate-100 text-slate-600 border-slate-300",

    // ---------------------------------

    dangerSoft: isDark
      ? "bg-slate-800 hover:bg-slate-700 text-red-400 border-slate-700"
      : "bg-slate-100 hover:bg-slate-200 text-red-600 border-slate-300",

    countBadge: isDark
      ? "bg-slate-800 text-slate-300 border-slate-700"
      : "bg-slate-100 text-slate-700 border-slate-300",
  };
}

export function getModalThemeClasses(isDark) {
  return {
    modal: isDark
      ? "bg-slate-900 border-slate-700 text-white"
      : "bg-white border-slate-200 text-slate-900 shadow-xl",

    overlay: isDark
      ? "bg-slate-950/70 backdrop-blur-sm"
      : "bg-black/40 backdrop-blur-sm",

    header: isDark
      ? "bg-slate-950/50 border-slate-800"
      : "bg-slate-50 border-slate-200",

    title: isDark ? "text-white" : "text-slate-900",

    label: isDark ? "text-slate-500" : "text-slate-600",

    input: isDark
      ? "bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400",

    closeButton: isDark
      ? "text-slate-500 hover:text-red-400 transition-colors"
      : "text-slate-500 hover:text-red-600 transition-colors",

    iconButton: isDark
      ? "absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors"
      : "absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors",

    helperText: "text-slate-500",

    divider: isDark ? "border-slate-700/30" : "border-slate-200",

    errorBox: isDark
      ? "text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-3 rounded-lg"
      : "text-red-600 text-xs bg-red-100 border border-red-200 p-3 rounded-lg",

    successIconWrap: isDark
      ? "w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20"
      : "w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200",

    bodyText: isDark ? "text-slate-400" : "text-slate-600",

    secondaryButton: isDark
      ? "flex-1 px-5 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors font-medium text-sm"
      : "flex-1 px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors font-medium text-sm",

    warningIconWrap: isDark
      ? "w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20"
      : "w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-200",

    toggleIdle: isDark
      ? "text-slate-400 hover:text-slate-200"
      : "text-slate-500 hover:text-slate-900",

    panelSurface: isDark
      ? "bg-slate-950 border-slate-800"
      : "bg-slate-50 border-slate-200",

    statsCard: isDark
      ? "bg-slate-800/30 border-slate-700"
      : "bg-slate-100 border-slate-200",

    accentText: isDark ? "text-blue-400" : "text-blue-600",
  };
}

// -----------------------------------

export function getUserManagementTableTheme(isDark) {
  return {
    container: isDark
      ? "border-slate-800 bg-slate-900/50"
      : "border-slate-200 bg-white shadow-sm",

    header: isDark
      ? "border-slate-800 bg-slate-950/30"
      : "border-slate-200 bg-slate-50",

    headingText: isDark ? "text-white" : "text-slate-900",

    filters: isDark
      ? "border-slate-800 bg-slate-950/20"
      : "border-slate-200 bg-slate-50/50",

    input: isDark
      ? "bg-slate-900 border-slate-700 text-slate-200"
      : "bg-white border-slate-200 text-slate-900",

    inputIcon: isDark ? "text-slate-500" : "text-slate-400",

    tableText: isDark ? "text-slate-400" : "text-slate-600",

    thead: isDark
      ? "bg-slate-950 text-slate-500"
      : "bg-slate-50 text-slate-600",

    tbodyDivide: isDark ? "divide-slate-800" : "divide-slate-200",

    rowHover: isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50",

    cellPrimary: isDark ? "text-slate-200" : "text-slate-900",

    cellSecondary: isDark ? "text-slate-500" : "text-slate-600",

    roleBadge: isDark
      ? "bg-slate-800 border-slate-700 text-slate-300"
      : "bg-slate-100 border-slate-200 text-slate-700",

    statusActive: isDark
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-emerald-100 text-emerald-700 border-emerald-200",

    statusInactive: isDark
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : "bg-red-100 text-red-700 border-red-200",

    editButton: isDark
      ? "text-slate-500 hover:text-blue-400 hover:bg-slate-800"
      : "text-slate-600 hover:text-blue-600 hover:bg-slate-100",

    deleteButton: isDark
      ? "text-slate-500 hover:text-red-400 hover:bg-slate-800"
      : "text-slate-600 hover:text-red-600 hover:bg-slate-100",

    emptyText: isDark ? "text-slate-600" : "text-slate-500",

    footer: isDark
      ? "border-slate-800 bg-slate-950/30 text-slate-500"
      : "border-slate-200 bg-slate-50 text-slate-600",

    footerBold: isDark ? "text-white" : "text-slate-900",

    paginationButton: isDark
      ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900",
    sectionTitle: isDark ? "text-slate-300" : "text-slate-700",

    miniLabel: isDark ? "text-slate-500" : "text-slate-600",

    selectWrap: isDark
      ? "bg-slate-900 border-slate-700"
      : "bg-white border-slate-300",

    selectText: isDark ? "text-white" : "text-slate-900",

    neutralBadge: isDark
      ? "bg-slate-800 text-slate-400"
      : "bg-slate-100 text-slate-600",

    linkButton:
      "text-xs text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1 px-2 py-1",

    topDivider: isDark ? "border-slate-800/50" : "border-slate-200",
  };
}
