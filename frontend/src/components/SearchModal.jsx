import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";

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

  const start = Math.max(0, firstMatchIndex - 30);
  const end = Math.min(text.length, firstMatchIndex + 60);
  return (start > 0 ? "..." : "") + text.substring(start, end).trim() + "...";
}

function HighlightedText({ text, searchTerms }) {
  if (!text || searchTerms.length === 0) return <span>{text}</span>;
  
  const regex = new RegExp(`(${searchTerms.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        searchTerms.some(term => term.toLowerCase() === part.toLowerCase()) ? (
          <span key={i} className="text-[color:var(--primary-brand)] bg-[color:var(--primary-brand)]/15 font-semibold px-1 rounded-sm">
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
    }).slice(0, 6);

    setResults(filtered);
  }

  function executeSearch(routeWithHash) {
    const [cleanRoute, hash] = routeWithHash.split('#');
    
    window.dispatchEvent(new CustomEvent("doc-change", { detail: cleanRoute }));
    setIsOpen(false);

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
    <div 
      className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex justify-center items-start pt-[12vh]"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()} 
      >
        <div className="flex items-center p-4 border-b border-slate-200 dark:border-slate-800">
          <svg className="mr-3 text-slate-500 dark:text-slate-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder={document.documentElement.dataset.searchPrompt || "Search documentation..."}
            value={query}
            onChange={handleSearch}
            onKeyDown={handleModalKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-lg text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
          <button 
            onClick={() => setIsOpen(false)} 
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            ESC
          </button>
        </div>

        {results.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
            {results.map((item, i) => {
              const isActive = i === selectedIndex;
              const snippet = getSnippet(item.content, activeSearchTerms);
              
              return (
                <div
                  key={i}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => executeSearch(item.route)}
                  className={`flex flex-col gap-1.5 p-3 cursor-pointer rounded-lg transition-colors border-l-2 ${isActive ? "bg-[color:var(--primary-brand)]/10 border-[color:var(--primary-brand)]" : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                >
                  <div className="flex items-center gap-2">
                    <svg className={isActive ? "text-[color:var(--primary-brand)]" : "text-slate-400 dark:text-slate-500"} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                       <line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line>
                    </svg>
                    <strong className={`text-sm font-semibold ${isActive ? "text-[color:var(--primary-brand)]" : "text-slate-900 dark:text-slate-100"}`}>{item.title}</strong>
                  </div>
                  
                  {/* Context Snippet */}
                  <span className="text-[13px] text-slate-500 dark:text-slate-400 pl-5 leading-relaxed">
                    <HighlightedText text={snippet} searchTerms={activeSearchTerms} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Empty State */}
        {query && results.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No results found for "<span className="font-medium text-slate-900 dark:text-slate-100">{query}</span>"
          </div>
        )}
      </div>
    </div>
  );
}