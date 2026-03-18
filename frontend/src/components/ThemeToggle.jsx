import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setIsDark(true);
      document.body.classList.add("dark");
    }
  }, []);

  // 2. Toggle function
  const toggleTheme = () => {
    if (isDark) {
      document.body.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.body.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid var(--border-color)",
        backgroundColor: "var(--bg-sidebar)",
        color: "var(--text-main)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontSize: "14px",
        fontWeight: "600",
        transition: "all 0.2s ease"
      }}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--text-muted)")}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
    >
      {isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}
    </button>
  );
}