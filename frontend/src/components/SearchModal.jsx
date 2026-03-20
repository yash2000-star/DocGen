import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";

// --- NEW: Extracts a small sentence around the matched word ---
function getSnippet(text, searchTerms) {
  if (!text || searchTerms.length === 0) return "";
  const lowerText = text.toLowerCase();
  let firstMatchIndex = -1;

  for (const term of searchTerms) {
    const idx = lowerText.indexOf(term);
    if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
      firstMatchIndex = idx;
    }
  }

  if (firstMatchIndex === -1) return text.substring(0, 80) + "...";

  // Grab ~30 characters before and ~60 after the match to create context
  const start = Math.max(0, firstMatchIndex - 30);
  const end = Math.min(text.length, firstMatchIndex + 60);
  return (start > 0 ? "..." : "") + text.substring(start, end).trim() + "...";
}

// --- NEW: Highlights the matched word in the snippet ---
function HighlightedText({ text, searchTerms }) {
  if (!text || searchTerms.length === 0) return <span>{text}</span>;
  
  // Creates a regex to find all search terms, ignoring case
  const regex = new RegExp(`(${searchTerms.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        searchTerms.some(term => term.toLowerCase() === part.toLowerCase()) ? (
          <span key={i} style={{ color: "var(--primary-brand)", fontWeight: "600", backgroundColor: "rgba(15, 186, 129, 0.15)", padding: "0 2px", borderRadius: "2px" }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export default function SearchModal() {
  const { tenant, version } = useParams();
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") setIsOpen(false);
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
    if (!tenant || !version) return;

    const API_URL = import.meta.env.VITE_API_URL;
    fetch(`${API_URL}/api/static/${tenant}/${version}/search-index.json`, { cache: "no-store" })
      .then(res => res.json())
      .then(data => setIndex(data))
      .catch(err => console.error("Search index failed to load:", err));
  }, [tenant, version]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  function handleSearch(e) {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(0);

    if (!value.trim()) {
      setResults([]);
      return;
    }

    const searchTerms = value.toLowerCase().split(' ').filter(Boolean);

    const filtered = index.filter(item => {
      const textToSearch = (item.title + " " + (item.content || "")).toLowerCase();
      return searchTerms.every(term => textToSearch.includes(term));
    }).slice(0, 6); // Top 6 results for a clean modal

    setResults(filtered);
  }

  function executeSearch(routeWithHash) {
    // Split the route from the deep-link hash!
    const [cleanRoute, hash] = routeWithHash.split('#');
    
    // 1. Tell DocPage to load the file
    window.dispatchEvent(new CustomEvent("doc-change", { detail: cleanRoute }));
    setIsOpen(false);

    // 2. Wait exactly 300ms for the MDX to render, then scroll to the exact heading!
    if (hash) {
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
    }
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

  const activeSearchTerms = query.toLowerCase().split(' ').filter(Boolean);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      paddingTop: "12vh", zIndex: 9999
    }} onClick={() => setIsOpen(false)}>
      
      <div 
        style={{
          width: "100%", maxWidth: "650px", backgroundColor: "#ffffff",
          borderRadius: "12px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column"
        }}
        onClick={e => e.stopPropagation()} 
      >
        {/* Search Input */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "12px" }}>
             <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documentation..."
            value={query}
            onChange={handleSearch}
            onKeyDown={handleModalKeyDown}
            style={{ flex: 1, border: "none", outline: "none", fontSize: "16px", color: "#0f172a", backgroundColor: "transparent" }}
          />
          <button onClick={() => setIsOpen(false)} style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", padding: "4px 8px",
            borderRadius: "6px", fontSize: "11px", color: "#64748b", cursor: "pointer", fontWeight: "600"
          }}>ESC</button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ padding: "12px", maxHeight: "450px", overflowY: "auto" }}>
            {results.map((item, i) => {
              const isActive = i === selectedIndex;
              const snippet = getSnippet(item.content, activeSearchTerms);
              
              return (
                <div
                  key={i}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => executeSearch(item.route)}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderRadius: "8px",
                    backgroundColor: isActive ? "rgba(15, 186, 129, 0.05)" : "transparent",
                    borderLeft: isActive ? "2px solid var(--primary-brand)" : "2px solid transparent",
                    marginLeft: "-2px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isActive ? "var(--primary-brand)" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                       <line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line>
                    </svg>
                    <strong style={{ fontSize: "14px", color: isActive ? "var(--primary-brand)" : "#0f172a", fontWeight: "600" }}>{item.title}</strong>
                  </div>
                  
                  {/* Context Snippet */}
                  <span style={{ fontSize: "13px", color: "#64748b", paddingLeft: "22px", lineHeight: "1.5" }}>
                    <HighlightedText text={snippet} searchTerms={activeSearchTerms} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Empty State */}
        {query && results.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
            No results found for "<span style={{ color: "#0f172a", fontWeight: "500" }}>{query}</span>"
          </div>
        )}
      </div>
    </div>
  );
}