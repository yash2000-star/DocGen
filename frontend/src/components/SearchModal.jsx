import { useEffect, useState, useRef } from "react";

export default function SearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentTenant, setCurrentTenant] = useState("company-a");
  const [currentVersion, setCurrentVersion] = useState("v1");
  const inputRef = useRef(null);

  // 1. Global Keyboard Listeners (Cmd+K to open, Esc to close)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleOpenSearch = () => setIsOpen(true);

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("open-search", handleOpenSearch); 

    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("open-search", handleOpenSearch);
    };
  }, []);

  useEffect(() => {
    function handleTenantChange(event) { setCurrentTenant(event.detail); }
    function handleVersionChange(event) { setCurrentVersion(event.detail); }
    window.addEventListener("tenant-change", handleTenantChange);
    window.addEventListener("version-change", handleVersionChange);
    return () => {
      window.removeEventListener("tenant-change", handleTenantChange);
      window.removeEventListener("version-change", handleVersionChange);
    };
  }, []);

  useEffect(() => {
    fetch(`/${currentTenant}/${currentVersion}/search-index.json`, { cache: "no-store" })
      .then(res => res.json())
      .then(data => setIndex(data))
      .catch(err => console.error("Search index failed to load:", err));
  }, [currentTenant, currentVersion]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // 3. Handle Typing & Filtering
  function handleSearch(e) {
    const value = e.target.value.toLowerCase();
    setQuery(value);
    setSelectedIndex(0);

    if (!value) {
      setResults([]);
      return;
    }

    const filtered = index.filter(item => 
      item.content.includes(value) || item.title.toLowerCase().includes(value)
    ).slice(0, 8);

    setResults(filtered);
  }

  // 4. Handle Navigation & Selection
  function executeSearch(route) {
    window.dispatchEvent(new CustomEvent("doc-change", { detail: route }));
    setIsOpen(false);
  }

  function handleModalKeyDown(e) {
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeSearch(results[selectedIndex].route);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      backgroundColor: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      paddingTop: "10vh", zIndex: 9999
    }} onClick={() => setIsOpen(false)}>
      
      {/* Modal Container */}
      <div 
        style={{
          width: "100%", maxWidth: "600px", backgroundColor: "#fff",
          borderRadius: "12px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          overflow: "hidden", border: "1px solid #e2e8f0"
        }}
        onClick={e => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        {/* Input Area */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px", borderBottom: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: "20px", marginRight: "12px", opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documentation..."
            value={query}
            onChange={handleSearch}
            onKeyDown={handleModalKeyDown}
            style={{
              flex: 1, border: "none", outline: "none", fontSize: "18px",
              color: "#0f172a", backgroundColor: "transparent"
            }}
          />
          <button onClick={() => setIsOpen(false)} style={{
            background: "#f1f5f9", border: "none", padding: "4px 8px",
            borderRadius: "6px", fontSize: "12px", color: "#64748b", cursor: "pointer", fontWeight: "bold"
          }}>ESC</button>
        </div>

        {/* Results Area */}
        {results.length > 0 && (
          <div style={{ padding: "8px" }}>
            {results.map((item, i) => {
              const isActive = i === selectedIndex;
              return (
                <div
                  key={i}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => executeSearch(item.route)}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderRadius: "8px",
                    backgroundColor: isActive ? "#3b82f6" : "transparent",
                    color: isActive ? "#ffffff" : "#334155",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }}
                >
                  <strong style={{ fontSize: "15px" }}>{item.title}</strong>
                  <span style={{ 
                    fontSize: "12px", 
                    color: isActive ? "#bfdbfe" : "#94a3b8",
                    fontFamily: "monospace" 
                  }}>
                    {item.route}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Empty State */}
        {query && results.length === 0 && (
          <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
            No results found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
}