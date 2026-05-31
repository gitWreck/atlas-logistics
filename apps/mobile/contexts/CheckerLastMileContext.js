import React, { createContext, useContext } from "react";
import { useAuth } from "./AuthContext";
import { useCheckerLastMileSync } from "../hooks/useCheckerLastMileSync";

const CheckerLastMileContext = createContext(null);

export function CheckerLastMileProvider({ children }) {
  const { profile } = useAuth();
  const value = useCheckerLastMileSync(profile?.uid);

  return (
    <CheckerLastMileContext.Provider value={value}>
      {children}
    </CheckerLastMileContext.Provider>
  );
}

export function useCheckerLastMile() {
  const ctx = useContext(CheckerLastMileContext);
  if (!ctx) {
    throw new Error(
      "useCheckerLastMile must be used within CheckerLastMileProvider",
    );
  }
  return ctx;
}
