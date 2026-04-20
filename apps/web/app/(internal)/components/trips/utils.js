function renderTimePair({
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  theme,
}) {
  return (
    <div className="space-y-1 min-w-[170px]">
      <div>
        <div
          className={`text-[10px] uppercase font-semibold ${theme.miniLabel}`}
        >
          {primaryLabel}
        </div>
        <div className={`text-sm font-semibold ${theme.cellPrimary}`}>
          {primaryValue || "—"}
        </div>
      </div>

      <div>
        <div
          className={`text-[10px] uppercase font-semibold ${theme.miniLabel}`}
        >
          {secondaryLabel}
        </div>
        <div className={`text-xs ${theme.cellSecondary}`}>
          {secondaryValue || "—"}
        </div>
      </div>
    </div>
  );
}

function buildInitialForm(trip = null) {
  return {
    tripId: trip?.tripId || trip?.id || "",
    tripType: trip?.tripType || "",
    // tripDocId: trip?.id || "",
    truckId: trip?.truckId || "",
    truckPlateNumber: trip?.truckPlateNumber || "",
    route: trip?.route || "",
    origin: trip?.origin || "",
    destination: trip?.destination || "",
    status: trip?.status || "",

    plannedDeparture: trip?.plannedDeparture || "",
    estimatedArrival: trip?.estimatedArrival || "",

    plannedLoadingStart: trip?.plannedLoadingStart || "",
    plannedLoadingEnd: trip?.plannedLoadingEnd || "",

    actualLoadingStart: trip?.actualLoadingStart || "",
    actualLoadingEnd: trip?.actualLoadingEnd || "",
    actualDeparture: trip?.actualDeparture || "",
    actualArrival: trip?.actualArrival || "",
  };
}

function ReadOnlyField({ label, type = "text", value, theme }) {
  return (
    <div>
      <label className={`text-xs font-semibold ${theme.label}`}>{label}</label>
      <input
        type={type}
        value={value || ""}
        readOnly
        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${theme.input}`}
      />
    </div>
  );
}

function DateTimeField({ label, value, onChange, theme }) {
  return (
    <div>
      <label className={`text-xs font-semibold ${theme.label}`}>{label}</label>
      <input
        type="datetime-local"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${theme.input}`}
      />
    </div>
  );
}

function getDayLabel(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    weekday: "long",
  });
}

export {
  renderTimePair,
  buildInitialForm,
  ReadOnlyField,
  DateTimeField,
  getDayLabel,
};
