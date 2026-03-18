import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "bb-theme-preference";
const DEFAULT_THEME = "green";

function getInitialTheme() {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "green"
    ? stored
    : DEFAULT_THEME;
}

export function useThemePreference() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return { theme, setTheme };
}
