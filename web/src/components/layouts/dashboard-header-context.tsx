'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type DashboardHeaderConfig = {
  title: string;
  actions?: ReactNode;
  showBack?: boolean;
};

type DashboardHeaderContextValue = {
  config: DashboardHeaderConfig | null;
  setConfig: (config: DashboardHeaderConfig | null) => void;
};

const DashboardHeaderContext = createContext<DashboardHeaderContextValue | null>(null);

export function DashboardHeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<DashboardHeaderConfig | null>(null);

  const setConfig = useCallback((next: DashboardHeaderConfig | null) => {
    setConfigState((prev) => {
      if (prev === null && next === null) return prev;
      if (
        prev &&
        next &&
        prev.title === next.title &&
        prev.showBack === next.showBack &&
        prev.actions === next.actions
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ config, setConfig }), [config, setConfig]);

  return (
    <DashboardHeaderContext.Provider value={value}>{children}</DashboardHeaderContext.Provider>
  );
}

export function useDashboardHeaderContext() {
  const ctx = useContext(DashboardHeaderContext);
  if (!ctx) {
    throw new Error('useDashboardHeaderContext must be used within DashboardHeaderProvider');
  }
  return ctx;
}

/**
 * Register page title/actions for the shell’s unified header.
 * Pass memoized `actions` when possible — unstable JSX references can cause extra renders.
 */
export function useDashboardHeader({
  title,
  actions,
  showBack,
}: DashboardHeaderConfig) {
  const { setConfig } = useDashboardHeaderContext();
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    setConfig({ title, showBack, actions: actionsRef.current });
  }, [title, showBack, actions, setConfig]);

  useEffect(() => {
    return () => setConfig(null);
  }, [setConfig]);
}

export function useDashboardHeaderReader() {
  return useDashboardHeaderContext().config;
}
