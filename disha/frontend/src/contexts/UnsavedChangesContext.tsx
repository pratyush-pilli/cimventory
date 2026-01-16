import React, { createContext, useContext, useState } from "react";

type UnsavedChangesContextType = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
};

const UnsavedChangesContext = createContext<
  UnsavedChangesContextType | undefined
>(undefined);

export const UnsavedChangesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  return (
    <UnsavedChangesContext.Provider
      value={{ hasUnsavedChanges, setHasUnsavedChanges }}
    >
      {children}
    </UnsavedChangesContext.Provider>
  );
};

export const useUnsavedChanges = () => {
  const context = useContext(UnsavedChangesContext);
  if (!context)
    throw new Error(
      "useUnsavedChanges must be used within UnsavedChangesProvider"
    );
  return context;
};