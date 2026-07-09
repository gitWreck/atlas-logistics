"use client";
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faCircleNotch } from "@fortawesome/free-solid-svg-icons";

export default function TrackingSearch({ onSearch, loading, initialValue }) {
  const [inputVal, setInputVal] = useState(initialValue || "");

  useEffect(() => {
    if (initialValue) {
      setInputVal(initialValue);
    }
  }, [initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    onSearch(inputVal.trim());
  };

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit} className="relative group">
        <input
          type="text"
          placeholder="Enter Tracking Number"
          className="w-full bg-white border border-slate-300 rounded-xl py-4 pl-4 pr-12 text-center font-mono text-lg text-slate-950 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400 uppercase"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-2 top-2 bottom-2 aspect-square bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
        >
          {loading ? (
            <FontAwesomeIcon icon={faCircleNotch} spin />
          ) : (
            <FontAwesomeIcon icon={faSearch} />
          )}
        </button>
      </form>
    </div>
  );
}
