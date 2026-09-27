import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const storageKey = "meridian.theme";
function preference() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (["light", "dark", "system"].includes(saved)) return saved;
  } catch {
    /* Private browsing can disable storage. */
  }
  return "system";
}
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(preference);
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const change = (event) => setSystemDark(event.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      /* Theme still works for this visit. */
    }
  }, [theme, resolved]);
  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
