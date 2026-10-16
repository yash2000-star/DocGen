import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { lineDiff, diffStats } from "../lib/lineDiff";
import SafeMdxRenderer from "../components/mdx/SafeMdxRenderer";

// The docs editor: the site's real pages (the files the published site is built from),
// with a live preview drawn by the same renderer readers see, history with restore, and
// review of AI updates for pages edited by hand.

const colors = { border: "#e2e8f0", muted: "#64748b", text: "#0f172a", accent: "#059669", danger: "#b91c1c", warn: "#b45309" };
const button = (kind = "secondary") => ({
  padding: "6px 12px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
  border: kind === "primary" ? "none" : `1px solid ${colors.border}`,
  backgroundColor: kind === "primary" ? colors.text : kind === "danger" ? "#fff" : "#fff",
  color: kind === "primary" ? "#fff" : kind === "danger" ? colors.danger : colors.text,
});

const SOURCE_LABELS = {
  generation: "Written by AI",
  update: "AI update after a push",
  editor: "Edited",
  restore: "Restored",
  baseline: "Earlier version",
};

const formatDate = (value) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

async function readJson(res) {
  return res.json().catch(() => ({}));
}

function DiffView({ before, after, testId }) {
  const diff = useMemo(() => lineDiff(before, after), [before, after]);
  const { added, removed } = diffStats(diff);
  if (!added && !removed) return <p style={{ fontSize: "13px", color: colors.muted }}>No differences.</p>;
  return (
    <div data-testid={testId}>
      <div style={{ fontSize: "12px", color: colors.muted, marginBottom: "6px" }}>
        <span style={{ color: colors.accent }}>+{added}</span> <span style={{ color: colors.danger }}>−{removed}</span> lines
      </div>
      <pre style={{ margin: 0, fontSize: "12px", lineHeight: 1.6, fontFamily: "ui-monospace, Menlo, monospace", border: `1px solid ${colors.border}`, borderRadius: "8px", overflow: "auto", maxHeight: "55vh", backgroundColor: "#fff" }}>
        {diff.map((line, i) => (
          <div key={i} className={`diff-${line.type}`} style={{ padding: "0 10px", whiteSpace: "pre-wrap", wordBreak: "break-word", backgroundColor: line.type === "add" ? "#ecfdf5" : line.type === "del" ? "#fef2f2" : "transparent", color: line.type === "del" ? "#991b1b" : line.type === "add" ? "#065f46" : "#334155" }}>
            {line.type === "add" ? "+ " : line.type === "del" ? "− " : "  "}{line.text}
          </div>
        ))}
      </pre>
    </div>
  );
}

function SidePanel({ title, onClose, children, testId }) {
  return (
    <aside data-testid={testId} style={{ width: "min(560px, 45vw)", borderLeft: `1px solid ${colors.border}`, backgroundColor: "#f8fafc", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, backgroundColor: "#fff" }}>
        <strong style={{ fontSize: "14px", color: colors.text }}>{title}</strong>
        <button type="button" onClick={onClose} aria-label="Close" style={{ ...button(), padding: "2px 8px" }}>✕</button>
      </div>
      <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>{children}</div>
    </aside>
  );
}

function PageTree({ site, route, onSelect, onCreate, canEdit }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const groups = [...new Set(site.navigation.map((g) => g.group))];
  const hasTabs = site.navigation.some((g) => g.tab);
  const tabName = (g) => g.tab || "Documentation";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const message = await onCreate(title, group || groups[0] || "Guides");
    setBusy(false);
    if (message) return setError(message);
    setAdding(false);
    setTitle("");
  };

  return (
    <nav data-testid="editor-pages" style={{ width: "250px", borderRight: `1px solid ${colors.border}`, backgroundColor: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: "13px", color: colors.text }}>Pages</strong>
        <Link to="../navigation" relative="path" style={{ fontSize: "12px", color: colors.muted }}>Edit navigation</Link>
      </div>
      <div style={{ padding: "8px", overflowY: "auto", flex: 1 }}>
        {site.navigation.length === 0 && <p style={{ fontSize: "13px", color: colors.muted, padding: "8px" }}>No pages yet. Generate docs from the dashboard, or add a page.</p>}
        {site.navigation.map((g, gi) => {
          const showTab = hasTabs && (gi === 0 || tabName(site.navigation[gi - 1]) !== tabName(g));
          return (
            <div key={`${g.tab}-${g.group}`} style={{ marginBottom: "10px" }}>
              {showTab && <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8", padding: "8px 8px 2px" }}>{tabName(g)}</div>}
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155", padding: "4px 8px" }}>{g.group}</div>
              {g.pages.map((r) => {
                const active = r === route;
                return (
                  <button key={r} type="button" data-route={r} onClick={() => onSelect(r)} style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", textAlign: "left", border: "none", borderRadius: "6px", padding: "5px 8px 5px 16px", fontSize: "13px", cursor: "pointer", backgroundColor: active ? "#ecfdf5" : "transparent", color: active ? colors.accent : "#475569", fontWeight: active ? 600 : 400 }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{site.pages[r]?.title || r}</span>
                    {site.suggestions.includes(r) && <span title="An AI update is waiting for review" data-testid="suggestion-dot" style={{ fontSize: "10px", fontWeight: 700, color: "#7c3aed" }}>AI</span>}
                    {site.handEdited.includes(r) && <span title="Edited by hand: AI updates come as suggestions" style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#f59e0b", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {canEdit && (
        <div style={{ borderTop: `1px solid ${colors.border}`, padding: "12px" }}>
          {adding ? (
            <form onSubmit={submit} style={{ display: "grid", gap: "8px" }}>
              <input autoFocus data-testid="new-page-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title" maxLength={120} style={{ padding: "7px 9px", border: `1px solid ${colors.border}`, borderRadius: "6px", fontSize: "13px" }} />
              <input data-testid="new-page-group" list="editor-groups" value={group} onChange={(e) => setGroup(e.target.value)} placeholder={groups[0] ? `Group (${groups[0]})` : "Group"} maxLength={80} style={{ padding: "7px 9px", border: `1px solid ${colors.border}`, borderRadius: "6px", fontSize: "13px" }} />
              <datalist id="editor-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
              {error && <p role="alert" style={{ margin: 0, fontSize: "12px", color: colors.danger }}>{error}</p>}
              <div style={{ display: "flex", gap: "6px" }}>
                <button type="submit" disabled={busy || !title.trim()} style={button("primary")}>{busy ? "Adding…" : "Add page"}</button>
                <button type="button" onClick={() => setAdding(false)} style={button()}>Cancel</button>
              </div>
            </form>
          ) : (
            <button type="button" data-testid="new-page" onClick={() => setAdding(true)} style={{ ...button(), width: "100%" }}>+ New page</button>
          )}
        </div>
      )}
    </nav>
  );
}

export default function Editor() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const route = searchParams.get("page");

  const [site, setSite] = useState(null);
  const [siteError, setSiteError] = useState(null);
  const [page, setPage] = useState(null); // the published version: { route, content, etag, suggestion, ... }
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState(null); // { kind: "ok" | "error" | "busy", text }
  const [preview, setPreview] = useState(null);
  const [view, setView] = useState("split");
  const [panel, setPanel] = useState(null); // "history" | "suggestion" | "conflict"
  const [conflict, setConflict] = useState(null);
  const [history, setHistory] = useState(null);
  const [selectedRevision, setSelectedRevision] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const textareaRef = useRef(null);

  const dirty = page !== null && draft !== page.content;
  // With a side panel open there's no room for two columns: show the source only.
  const shownView = panel && view === "split" ? "write" : view;
  const canEdit = Boolean(site?.canEdit);
  const busy = status?.kind === "busy";

  const loadSite = useCallback(async () => {
    const res = await apiFetch(`/api/projects/${id}/pages`).catch(() => null);
    const data = res ? await readJson(res) : {};
    if (!res?.ok) return setSiteError(data.error || "Couldn't load the pages.");
    setSite(data);
    return data;
  }, [id]);

  useEffect(() => {
    loadSite().then((data) => {
      if (data && !route) {
        const first = data.navigation[0]?.pages[0];
        if (first) setSearchParams({ page: first }, { replace: true });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per project
  }, [loadSite]);

  // Load the selected page.
  useEffect(() => {
    if (!route) return;
    let cancelled = false;
    apiFetch(`/api/projects/${id}/page?route=${encodeURIComponent(route)}`)
      .then(async (res) => {
        const data = await readJson(res);
        if (cancelled) return;
        if (!res.ok) {
          setPage(null);
          setStatus({ kind: "error", text: data.error || "Couldn't load this page." });
          return;
        }
        setPage(data);
        setDraft(data.content);
        setStatus(null);
        setPanel(null);
        setConflict(null);
      })
      .catch(() => !cancelled && setStatus({ kind: "error", text: "Couldn't reach the server." }));
    return () => { cancelled = true; };
  }, [id, route]);

  // Live preview, compiled by the server with the same rules as the published site.
  useEffect(() => {
    if (page === null) return;
    const timer = setTimeout(async () => {
      const res = await apiFetch(`/api/projects/${id}/preview`, { method: "POST", body: JSON.stringify({ content: draft }) }).catch(() => null);
      if (res?.ok) setPreview(await readJson(res));
    }, 350);
    return () => clearTimeout(timer);
  }, [id, draft, page]);

  // Leaving with unpublished changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const selectPage = (next) => {
    if (next === route) return;
    if (dirty && !window.confirm("You have unpublished changes on this page. Discard them?")) return;
    setPreview(null);
    setSearchParams({ page: next });
  };

  // Applies a saved version returned by the server.
  const applySaved = (data, content, text) => {
    setPage((p) => ({ ...p, content, etag: data.etag, handEdited: true, suggestion: null }));
    setSite((s) => ({ ...s, handEdited: [...new Set([...s.handEdited, page.route])], suggestions: s.suggestions.filter((r) => r !== page.route) }));
    setDraft(content);
    setStatus(data.published === false ? { kind: "error", text: data.buildError } : { kind: "ok", text });
    loadSite();
  };

  const publish = async ({ overrideEtag } = {}) => {
    if (!page || !canEdit || busy) return;
    setStatus({ kind: "busy", text: "Publishing…" });
    const content = draft;
    const res = await apiFetch(`/api/projects/${id}/page?route=${encodeURIComponent(page.route)}`, {
      method: "PUT", body: JSON.stringify({ content, baseEtag: overrideEtag || page.etag }),
    }).catch(() => null);
    const data = res ? await readJson(res) : {};
    if (res?.status === 409) {
      setConflict(data.current);
      setPanel("conflict");
      return setStatus({ kind: "error", text: data.error });
    }
    if (!res?.ok) return setStatus({ kind: "error", text: data.error || "Couldn't publish this page." });
    setConflict(null);
    if (panel === "conflict") setPanel(null);
    applySaved(data, content, "Published");
  };

  // Ctrl/Cmd+S publishes.
  const publishRef = useRef(publish);
  useEffect(() => { publishRef.current = publish; });
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        publishRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const createPage = async (title, group) => {
    const res = await apiFetch(`/api/projects/${id}/pages`, { method: "POST", body: JSON.stringify({ title, group }) }).catch(() => null);
    const data = res ? await readJson(res) : {};
    if (!res?.ok) return data.error || "Couldn't add the page.";
    await loadSite();
    setSearchParams({ page: data.route });
    return null;
  };

  const deletePage = async () => {
    if (!window.confirm(`Delete "${page.title}"? You can restore it from its history later.`)) return;
    setStatus({ kind: "busy", text: "Deleting…" });
    const res = await apiFetch(`/api/projects/${id}/page?route=${encodeURIComponent(page.route)}`, { method: "DELETE" }).catch(() => null);
    const data = res ? await readJson(res) : {};
    if (!res?.ok) return setStatus({ kind: "error", text: data.error || "Couldn't delete the page." });
    const next = await loadSite();
    setPage(null);
    setStatus({ kind: "ok", text: `Deleted ${page.title}` });
    const first = next?.navigation[0]?.pages[0];
    setSearchParams(first ? { page: first } : {});
  };

  const openHistory = async () => {
    setPanel("history");
    setHistory(null);
    setSelectedRevision(null);
    const res = await apiFetch(`/api/projects/${id}/history?route=${encodeURIComponent(page.route)}`).catch(() => null);
    const data = res ? await readJson(res) : {};
    setHistory(res?.ok ? data.revisions : []);
  };

  const showRevision = async (revision) => {
    const res = await apiFetch(`/api/projects/${id}/revisions/${revision.id}`).catch(() => null);
    if (res?.ok) setSelectedRevision(await readJson(res));
  };

  const restore = async () => {
    if (dirty && !window.confirm("Restoring replaces your unpublished changes. Continue?")) return;
    setStatus({ kind: "busy", text: "Restoring…" });
    const res = await apiFetch(`/api/projects/${id}/revisions/${selectedRevision.id}/restore`, { method: "POST", body: JSON.stringify({ baseEtag: page.etag }) }).catch(() => null);
    const data = res ? await readJson(res) : {};
    if (!res?.ok) return setStatus({ kind: "error", text: data.error || "Couldn't restore that version." });
    setPanel(null);
    applySaved(data, data.content, "Restored and published");
  };

  const openSuggestion = async () => {
    setPanel("suggestion");
    setSuggestion(null);
    const res = await apiFetch(`/api/projects/${id}/suggestion?route=${encodeURIComponent(page.route)}`).catch(() => null);
    if (res?.ok) setSuggestion(await readJson(res));
  };

  const acceptSuggestion = async () => {
    if (dirty && !window.confirm("Accepting replaces your unpublished changes. Continue?")) return;
    setStatus({ kind: "busy", text: "Publishing the suggestion…" });
    const res = await apiFetch(`/api/projects/${id}/suggestion/accept?route=${encodeURIComponent(page.route)}`, { method: "POST", body: JSON.stringify({ baseEtag: page.etag }) }).catch(() => null);
    const data = res ? await readJson(res) : {};
    if (!res?.ok) return setStatus({ kind: "error", text: data.error || "Couldn't accept the suggestion." });
    setPanel(null);
    applySaved(data, data.content, "Suggestion accepted and published");
  };

  const dismissSuggestion = async () => {
    const res = await apiFetch(`/api/projects/${id}/suggestion/dismiss?route=${encodeURIComponent(page.route)}`, { method: "POST" }).catch(() => null);
    if (!res?.ok) return setStatus({ kind: "error", text: "Couldn't dismiss the suggestion." });
    setPanel(null);
    setPage((p) => ({ ...p, suggestion: null }));
    setStatus({ kind: "ok", text: "Suggestion dismissed" });
    loadSite();
  };

  if (siteError) return <div style={{ padding: "40px", color: colors.danger }}>{siteError}</div>;
  if (!site) return <div style={{ padding: "40px", fontFamily: "system-ui", color: colors.muted }}>Loading editor…</div>;

  const docsBase = `/docs/${site.tenant}/${site.project}`;
  const statusText = busy ? status.text : status?.kind === "error" ? status.text : dirty ? "Unpublished changes" : status?.text || (page ? "Published" : "");

  return (
    <div style={{ position: "fixed", top: 0, left: "250px", right: 0, bottom: 0, backgroundColor: "#fff", zIndex: 100, display: "flex", flexDirection: "column", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", height: "56px", padding: "0 16px", borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page?.title || "Editor"}</div>
          {page && <div style={{ fontSize: "12px", color: colors.muted }}>{docsBase}/{page.route}</div>}
        </div>
        <span data-testid="editor-status" role="status" style={{ fontSize: "12px", color: status?.kind === "error" ? colors.danger : dirty ? colors.warn : colors.muted, maxWidth: "40%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={statusText}>{statusText}</span>
        <div role="group" aria-label="View" style={{ display: "flex", border: `1px solid ${colors.border}`, borderRadius: "6px", overflow: "hidden" }}>
          {["write", "split", "preview"].map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} style={{ padding: "5px 10px", fontSize: "12px", border: "none", cursor: "pointer", backgroundColor: view === v ? "#f1f5f9" : "#fff", color: view === v ? colors.text : colors.muted, fontWeight: view === v ? 600 : 400, textTransform: "capitalize" }}>{v}</button>
          ))}
        </div>
        {page && <button type="button" data-testid="open-history" onClick={openHistory} style={button()}>History</button>}
        {page && <a href={`${docsBase}/${page.route}`} target="_blank" rel="noopener noreferrer" style={{ ...button(), textDecoration: "none" }}>View page</a>}
        {page && canEdit && <button type="button" data-testid="delete-page" onClick={deletePage} disabled={busy} style={button("danger")}>Delete</button>}
        {canEdit && (
          <button type="button" data-testid="publish" onClick={() => publish()} disabled={!page || !dirty || busy} title="Publish (Ctrl+S)" style={{ ...button("primary"), opacity: !page || !dirty || busy ? 0.5 : 1 }}>
            {busy ? "Publishing…" : "Publish"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <PageTree site={site} route={route} onSelect={selectPage} onCreate={createPage} canEdit={canEdit} />

        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {page?.suggestion && (
            <div data-testid="suggestion-banner" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", backgroundColor: "#f5f3ff", borderBottom: "1px solid #ddd6fe", fontSize: "13px", color: "#5b21b6" }}>
              <span style={{ flex: 1 }}>
                You edited this page, so DocGen didn't overwrite it. An AI update is waiting for review ({page.suggestion.message || SOURCE_LABELS[page.suggestion.source]}, {formatDate(page.suggestion.createdAt)}).
              </span>
              <button type="button" data-testid="review-suggestion" onClick={openSuggestion} style={button()}>Review</button>
            </div>
          )}
          {!canEdit && <div style={{ padding: "8px 16px", fontSize: "13px", color: colors.muted, backgroundColor: "#f8fafc", borderBottom: `1px solid ${colors.border}` }}>You can view these pages. Ask a project admin for editor access to change them.</div>}

          {!page ? (
            <div style={{ padding: "48px", textAlign: "center", color: colors.muted, fontSize: "14px" }}>{route ? "Loading…" : "Select a page, or add one."}</div>
          ) : (
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              {shownView !== "preview" && (
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", borderRight: shownView === "split" ? `1px solid ${colors.border}` : "none" }}>
                  <textarea
                    ref={textareaRef}
                    data-testid="editor-source"
                    aria-label="Page source (MDX)"
                    value={draft}
                    readOnly={!canEdit}
                    spellCheck={false}
                    onChange={(e) => setDraft(e.target.value)}
                    style={{ flex: 1, width: "100%", resize: "none", border: "none", outline: "none", padding: "20px 24px", fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace", fontSize: "13.5px", lineHeight: 1.7, color: "#1e293b", backgroundColor: "#fff", tabSize: 2 }}
                  />
                  {preview && !preview.ok && (
                    <div data-testid="editor-error" role="alert" style={{ padding: "8px 16px", fontSize: "12px", color: colors.danger, backgroundColor: "#fef2f2", borderTop: "1px solid #fecaca" }}>
                      {preview.error.line ? `Line ${preview.error.line}: ` : ""}{preview.error.message}
                    </div>
                  )}
                </div>
              )}
              {shownView !== "write" && (
                <div data-testid="editor-preview" style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "32px 40px", backgroundColor: "#fff" }}>
                  {preview?.ok ? (
                    <article>
                      <h1 style={{ fontSize: "30px", fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>{preview.title || page.title}</h1>
                      {preview.description && <p style={{ fontSize: "16px", color: colors.muted, margin: "0 0 24px" }}>{preview.description}</p>}
                      <div className="mdx-content"><SafeMdxRenderer tree={preview.tree} linkBase={docsBase} sitePrefix={docsBase} /></div>
                    </article>
                  ) : preview ? (
                    <p style={{ color: colors.muted, fontSize: "14px" }}>The preview updates when the page compiles again.</p>
                  ) : (
                    <p style={{ color: colors.muted, fontSize: "14px" }}>Loading preview…</p>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {panel === "history" && page && (
          <SidePanel title="Page history" onClose={() => setPanel(null)} testId="history-panel">
            {history === null ? <p style={{ fontSize: "13px", color: colors.muted }}>Loading…</p> : history.length === 0 ? (
              <p style={{ fontSize: "13px", color: colors.muted }}>No history yet. Versions are recorded from the next change on.</p>
            ) : (
              <ol style={{ listStyle: "none", margin: "0 0 16px", padding: 0, display: "grid", gap: "4px" }}>
                {history.map((r, i) => (
                  <li key={r.id}>
                    <button type="button" data-testid="history-entry" onClick={() => showRevision(r)} style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: "6px", cursor: "pointer", border: `1px solid ${selectedRevision?.id === r.id ? "#94a3b8" : colors.border}`, backgroundColor: "#fff" }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: colors.text }}>
                        {r.deleted ? "Deleted" : r.message || SOURCE_LABELS[r.source]}{i === 0 && !r.deleted ? <span style={{ color: colors.muted, fontWeight: 400 }}> · current</span> : null}
                      </div>
                      <div style={{ fontSize: "12px", color: colors.muted }}>{SOURCE_LABELS[r.source]} · {formatDate(r.created_at)}</div>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {selectedRevision && (
              <div>
                <p style={{ fontSize: "13px", color: "#334155", margin: "0 0 8px" }}>Restoring this version would make these changes to the page:</p>
                <DiffView before={draft} after={selectedRevision.content} testId="history-diff" />
                {canEdit && <button type="button" data-testid="restore" onClick={restore} disabled={busy || selectedRevision.content === page.content} style={{ ...button("primary"), marginTop: "12px" }}>Restore this version</button>}
              </div>
            )}
          </SidePanel>
        )}

        {panel === "suggestion" && page && (
          <SidePanel title="AI suggestion" onClose={() => setPanel(null)} testId="suggestion-panel">
            {!suggestion ? <p style={{ fontSize: "13px", color: colors.muted }}>Loading…</p> : (
              <>
                <p style={{ fontSize: "13px", color: "#334155", margin: "0 0 8px" }}>Accepting would make these changes to the published page:</p>
                <DiffView before={page.content} after={suggestion.content} testId="suggestion-diff" />
                {canEdit && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button type="button" data-testid="accept-suggestion" onClick={acceptSuggestion} disabled={busy} style={button("primary")}>Accept and publish</button>
                    <button type="button" data-testid="edit-suggestion" onClick={() => { setDraft(suggestion.content); setPanel(null); setStatus({ kind: "ok", text: "Suggestion loaded into the editor. Publish when ready." }); }} style={button()}>Edit before publishing</button>
                    <button type="button" data-testid="dismiss-suggestion" onClick={dismissSuggestion} style={button()}>Dismiss</button>
                  </div>
                )}
              </>
            )}
          </SidePanel>
        )}

        {panel === "conflict" && conflict && (
          <SidePanel title="This page changed" onClose={() => setPanel(null)} testId="conflict-panel">
            <p style={{ fontSize: "13px", color: "#334155", margin: "0 0 8px" }}>
              Someone else (or an AI update) published this page after you opened it. Publishing yours would make these changes to their version:
            </p>
            <DiffView before={conflict.content} after={draft} testId="conflict-diff" />
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button type="button" data-testid="publish-mine" onClick={() => publish({ overrideEtag: conflict.etag })} disabled={busy} style={button("primary")}>Publish mine anyway</button>
              <button type="button" data-testid="use-theirs" onClick={() => { setPage((p) => ({ ...p, content: conflict.content, etag: conflict.etag })); setDraft(conflict.content); setPanel(null); setConflict(null); setStatus({ kind: "ok", text: "Loaded the latest version" }); }} style={button()}>Use their version</button>
            </div>
          </SidePanel>
        )}
      </div>
    </div>
  );
}
