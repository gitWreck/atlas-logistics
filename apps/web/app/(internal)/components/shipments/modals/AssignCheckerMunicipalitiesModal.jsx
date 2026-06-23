"use client";

import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleNotch,
  faMapMarkedAlt,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { assignCheckerMunicipalities } from "@/app/utility/FirebaseFunctions";
import { DELIVERY_MUNICIPALITIES } from "@/app/utility/deliveryMunicipalities";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";

export default function AssignCheckerMunicipalitiesModal({
  isOpen,
  onClose,
  onSuccess,
  isDark = false,
  user = null,
}) {
  const theme = getModalThemeClasses(isDark);
  const actions = getModalActionClasses();
  const [checkers, setCheckers] = useState([]);
  const [checkerId, setCheckerId] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    const loadCheckers = async () => {
      try {
        const token = user ? await user.getIdToken() : null;
        const res = await fetch("/api/checkers/active", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = res.ok ? await res.json() : { checkers: [] };
        if (!cancelled) setCheckers(data.checkers || []);
      } catch {
        if (!cancelled) setCheckers([]);
      }
    };

    loadCheckers();

    return () => {
      cancelled = true;
    };
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    setCheckerId("");
    setSelected([]);
    setError("");
  }, [isOpen]);

  useEffect(() => {
    if (!checkerId) {
      setSelected([]);
      return;
    }
    const checker = checkers.find((entry) => entry.id === checkerId);
    setSelected(
      Array.isArray(checker?.assignedMunicipalities)
        ? checker.assignedMunicipalities
        : [],
    );
  }, [checkerId, checkers]);

  if (!isOpen) return null;

  const toggleMunicipality = (value) => {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((entry) => entry !== value)
        : [...prev, value],
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!checkerId) {
      setError("Select a checker.");
      return;
    }
    if (!selected.length) {
      setError("Select at least one municipality.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await assignCheckerMunicipalities({
        checkerId,
        municipalities: selected,
      });
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Failed to assign municipalities.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${theme.overlay}`} onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-2xl border ${theme.modal}`}>
        <div className={`px-6 py-4 border-b flex justify-between items-center ${theme.header}`}>
          <h3 className={`font-bold flex items-center gap-2 ${theme.title}`}>
            <FontAwesomeIcon icon={faMapMarkedAlt} className="text-sky-500" />
            Assign Checker Municipalities
          </h3>
          <button type="button" onClick={onClose} className={theme.closeButton}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${theme.label}`}>
              Checker
            </label>
            <select
              className={`w-full border rounded-lg px-4 py-2 ${theme.input}`}
              value={checkerId}
              onChange={(e) => setCheckerId(e.target.value)}
              required
            >
              <option value="">Select checker...</option>
              {checkers.map((checker) => (
                <option key={checker.id} value={checker.id}>
                  {checker.name || checker.fullName || checker.email || checker.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-[10px] font-bold uppercase mb-2 ${theme.label}`}>
              Municipalities
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar">
              {DELIVERY_MUNICIPALITIES.map((entry) => {
                const active = selected.includes(entry);
                return (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => toggleMunicipality(entry)}
                    className={`text-left text-sm rounded-lg border px-3 py-2 transition-colors ${
                      active
                        ? "bg-sky-600 text-white border-sky-500"
                        : isDark
                          ? "border-slate-700 text-slate-200 hover:border-sky-500"
                          : "border-slate-300 text-slate-700 hover:border-sky-500"
                    }`}
                  >
                    {entry}
                  </button>
                );
              })}
            </div>
          </div>

          <p className={`text-xs ${theme.helperText}`}>
            Multiple checkers can share the same municipality. Checkers only see
            and load shipments for their assigned areas.
          </p>

          {error ? <div className={theme.errorBox}>{error}</div> : null}

          <button type="submit" disabled={loading} className={actions.primary}>
            {loading ? (
              <FontAwesomeIcon icon={faCircleNotch} spin />
            ) : (
              "Save assignment"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
