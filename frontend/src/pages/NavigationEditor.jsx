import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

// The sidebar of the published site: groups of pages, optionally in tabs. Saved into the
// site's docs.json and published right away.

const DEFAULT_TAB = "Documentation";
const colors = { border: "#e2e8f0", muted: "#64748b", text: "#0f172a", danger: "#b91c1c" };
const small = { padding: "3px 8px", fontSize: "12px", border: `1px solid ${colors.border}`, borderRadius: "6px", backgroundColor: "#fff", cursor: "pointer", color: "#334155" };
const input = { padding: "7px 10px", border: `1px solid ${colors.border}`, borderRadius: "6px", fontSize: "13px", color: colors.text, minWidth: 0 };

const move = (list, from, to) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export default function NavigationEditor() {
  const { id } = useParams();
  const [site, setSite] = useState(null);
  const [groups, setGroups] = useState([]);
  const [saved, setSaved] = useState("[]");
  const [status, setStatus] = useState(null); // { kind, text }
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch(`/api/projects/${id}/pages`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return setError(data.error || "Couldn't load the navigation.");
        const loaded = data.navigation.map((g) => ({ group: g.group, tab: g.tab || "", pages: g.pages }));
        setSite(data);
        setGroups(loaded);
        setSaved(JSON.stringify(loaded));
      })
      .catch(() => setError("Couldn't reach the server."));
  }, [id]);

  const dirty = JSON.stringify(groups) !== saved;
  const canEdit = Boolean(site?.canEdit);
  const tabs = [...new Set([DEFAULT_TAB, ...groups.map((g) => g.tab).filter(Boolean)])];

  const update = (index, changes) => setGroups((gs) => gs.map((g, i) => (i === index ? { ...g, ...changes } : g)));
  const movePage = (from, pageIndex, toGroup) => setGroups((gs) => {
    const route = gs[from].pages[pageIndex];
    return gs.map((g, i) => {
      if (i === from && i === toGroup) return g;
      if (i === from) return { ...g, pages: g.pages.filter((_, p) => p !== pageIndex) };
      if (i === toGroup) return { ...g, pages: [...g.pages, route] };
      return g;
    });
  });

  const save = async () => {
    setStatus({ kind: "busy", text: "Publishing…" });
    const navigation = groups.filter((g) => g.pages.length).map((g) => ({ group: g.group.trim(), tab: g.tab.trim() || null, pages: g.pages }));
    const res = await apiFetch(`/api/projects/${id}/navigation`, { method: "PUT", body: JSON.stringify({ navigation }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setStatus({ kind: "error", text: data.error || "Couldn't save the navigation." });
    const next = data.navigation.map((g) => ({ group: g.group, tab: g.tab || "", pages: g.pages }));
    setGroups(next);
    setSaved(JSON.stringify(next));
    setStatus(data.published === false ? { kind: "error", text: data.buildError } : { kind: "ok", text: "Published" });
  };

  if (error) return <div style={{ padding: "40px", color: colors.danger }}>{error}</div>;
  if (!site) return <div style={{ padding: "40px", color: colors.muted }}>Loading navigation…</div>;

  return (
    <div style={{ maxWidth: "860px", padding: "8px 0 48px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: colors.text, margin: "0 0 4px" }}>Navigation</h1>
          <p style={{ fontSize: "14px", color: colors.muted, margin: 0 }}>
            The sidebar of your docs. Groups in the same tab are shown together; leave the tab empty for {DEFAULT_TAB}. Pages are edited in the <Link to="../editor" relative="path">editor</Link>.
          </p>
        </div>
        {canEdit && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
            {status && <span data-testid="nav-status" role="status" style={{ fontSize: "12px", color: status.kind === "error" ? colors.danger : colors.muted }}>{status.text}</span>}
            <button type="button" data-testid="nav-save" onClick={save} disabled={!dirty || status?.kind === "busy"} style={{ padding: "8px 16px", border: "none", borderRadius: "8px", backgroundColor: colors.text, color: "#fff", fontWeight: 600, fontSize: "13px", cursor: "pointer", opacity: !dirty || status?.kind === "busy" ? 0.5 : 1 }}>
              Publish navigation
            </button>
          </div>
        )}
      </div>

      {groups.length === 0 && <p style={{ color: colors.muted, fontSize: "14px" }}>No pages yet.</p>}

      <datalist id="nav-tabs">{tabs.map((t) => <option key={t} value={t} />)}</datalist>
      <div style={{ display: "grid", gap: "12px" }}>
        {groups.map((g, gi) => (
          <section key={gi} data-testid="nav-group" style={{ border: `1px solid ${colors.border}`, borderRadius: "10px", padding: "12px", backgroundColor: "#fff" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
              <input aria-label="Group name" data-testid="nav-group-name" value={g.group} disabled={!canEdit} onChange={(e) => update(gi, { group: e.target.value })} maxLength={80} style={{ ...input, flex: "2 1 200px", fontWeight: 600 }} />
              <input aria-label="Tab" data-testid="nav-group-tab" value={g.tab} disabled={!canEdit} list="nav-tabs" placeholder={DEFAULT_TAB} onChange={(e) => update(gi, { tab: e.target.value })} maxLength={40} style={{ ...input, flex: "1 1 140px" }} />
              {canEdit && (
                <>
                  <button type="button" aria-label="Move group up" onClick={() => setGroups((gs) => move(gs, gi, gi - 1))} disabled={gi === 0} style={small}>↑</button>
                  <button type="button" aria-label="Move group down" onClick={() => setGroups((gs) => move(gs, gi, gi + 1))} disabled={gi === groups.length - 1} style={small}>↓</button>
                  <button type="button" onClick={() => setGroups((gs) => gs.filter((_, i) => i !== gi))} disabled={g.pages.length > 0} title={g.pages.length ? "Move its pages to another group first" : "Remove group"} style={{ ...small, color: colors.danger }}>Remove</button>
                </>
              )}
            </div>
            {g.pages.length === 0 && <p style={{ fontSize: "12px", color: colors.muted, margin: "4px 0" }}>Empty. Move pages here, or remove the group.</p>}
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "4px" }}>
              {g.pages.map((route, pi) => (
                <li key={route} data-testid="nav-page" data-route={route} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "6px", backgroundColor: "#f8fafc" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: "13px", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {site.pages[route]?.title || route} <span style={{ color: "#94a3b8" }}>/{route}</span>
                  </span>
                  {canEdit && (
                    <>
                      <button type="button" aria-label="Move page up" onClick={() => update(gi, { pages: move(g.pages, pi, pi - 1) })} disabled={pi === 0} style={small}>↑</button>
                      <button type="button" aria-label="Move page down" onClick={() => update(gi, { pages: move(g.pages, pi, pi + 1) })} disabled={pi === g.pages.length - 1} style={small}>↓</button>
                      <select aria-label="Move to group" value={gi} onChange={(e) => movePage(gi, pi, Number(e.target.value))} style={{ ...small, maxWidth: "160px" }}>
                        {groups.map((other, oi) => <option key={oi} value={oi}>{oi === gi ? "Move to…" : other.group || "(unnamed)"}</option>)}
                      </select>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {canEdit && (
        <button type="button" data-testid="nav-add-group" onClick={() => setGroups((gs) => [...gs, { group: "New group", tab: "", pages: [] }])} style={{ ...small, marginTop: "12px", padding: "8px 14px", fontSize: "13px" }}>
          + Add group
        </button>
      )}
    </div>
  );
}
