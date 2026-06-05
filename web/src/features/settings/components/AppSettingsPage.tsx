'use client';

import { useEffect, useState } from 'react';
import { ListPageLayout } from '@/components/layouts';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Sun, Moon } from 'lucide-react';

type Prefs = {
  compactMode: boolean;
  reducedMotion: boolean;
};

const STORAGE_KEY = 'app-ui-prefs';

export function AppSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>({ compactMode: false, reducedMotion: false });
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Prefs>;
      setPrefs({
        compactMode: Boolean(parsed.compactMode),
        reducedMotion: Boolean(parsed.reducedMotion),
      });
    } catch {
      // ignore malformed local settings
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    document.documentElement.dataset.compact = prefs.compactMode ? '1' : '0';
    document.documentElement.dataset.reducedMotion = prefs.reducedMotion ? '1' : '0';
  }, [prefs]);

  return (
    <ListPageLayout
      title="Settings"
      maxWidthClass="max-w-3xl"
    >
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-card-foreground">Theme</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose between light and dark mode for the interface.
        </p>
        <div className="mt-5">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted/40"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4" />
                <span>Switch to Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                <span>Switch to Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-card-foreground">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The interface uses the selected theme across the app.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-card-foreground">Accessibility</h2>
        <p className="mt-1 text-sm text-muted-foreground">Improve comfort based on your preferences.</p>
        <div className="mt-5 space-y-3">
          <label className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-card-foreground">Compact mode</p>
              <p className="text-xs text-muted-foreground">Reduce spacing density in list screens.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.compactMode}
              onChange={(e) => setPrefs((p) => ({ ...p, compactMode: e.target.checked }))}
              className="h-4 w-4 accent-primary"
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-card-foreground">Reduced motion</p>
              <p className="text-xs text-muted-foreground">Minimize UI transition effects.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.reducedMotion}
              onChange={(e) => setPrefs((p) => ({ ...p, reducedMotion: e.target.checked }))}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>
      </section>
    </ListPageLayout>
  );
}
