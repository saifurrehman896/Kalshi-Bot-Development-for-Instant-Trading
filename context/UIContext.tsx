// context/UIContext.tsx
"use client";

import { createContext, useContext, useState } from "react";

type UIContextType = {
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
};

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState("Politics");

  return (
    <UIContext.Provider value={{ selectedCategory, setSelectedCategory }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}