import { useEffect, useState } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("orange-theme");
    if (stored) return stored === "dark";
    return false; // Default to Complete Light Theme!
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("orange-theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("orange-theme", "light");
    }
  }, [isDark]);

  const toggle = () => setIsDark(prev => !prev);

  return { isDark, toggle };
}
