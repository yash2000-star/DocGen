import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../lib/api";

const API_HOST = (() => {
  try { return new URL(import.meta.env.VITE_API_URL).hostname; } catch { return "your DocGen server"; }
})();

const label = { fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" };
const mono = { fontFamily: "ui-monospace, Menlo, monospace", fontSize: "13px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 10px", wordBreak: "break-all" };
const button = (primary) => ({ padding: "10px 16px", backgroundColor: primary ? "#0f172a" : "#fff", color: primary ? "#fff" : "#0f172a", border: primary ? "none" : "1px solid #e2e8f0", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" });

// A custom domain serves the docs once a DNS TXT record proves the project owns it.
export default function DomainSetup() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, domain: null });
  const [domainInput, setDomainInput] = useState("");
  const [busy, setBusy] = useState(null); // "save" | "verify" | "remove"
  const [message, setMessage] = useState(null); // { kind: "error" | "ok", text }

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/projects/${id}/domain`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) return setState({ loading: false, domain: null, error: data.error || `HTTP ${res.status}` });
        setState({ loading: false, ...data });
        setDomainInput(data.domain || "");
      })
      .catch(() => !cancelled && setState({ loading: false, domain: null, error: "Couldn't reach the server." }));
    return () => { cancelled = true; };
  }, [id]);

  const call = async (kind, method, path, body) => {
    setBusy(kind);
    setMessage(null);
    const res = await apiFetch(path, { method, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(null);
    if (!res?.ok) {
      setMessage({ kind: "error", text: data?.error || "Something went wrong." });
      return null;
    }
    setState({ loading: false, ...data });
    return data;
  };

  const save = async () => {
    const data = await call("save", "PUT", `/api/projects/${id}/domain`, { domain: domainInput });
    if (data) {
      setDomainInput(data.domain);
      setMessage({ kind: "ok", text: "Domain added. Add the DNS records below, then verify." });
    }
  };
  const verify = async () => {
    const data = await call("verify", "POST", `/api/projects/${id}/domain/verify`);
    if (data?.verified) setMessage({ kind: "ok", text: `Verified. Your docs are served at https://${data.domain}.` });
  };
  const remove = async () => {
    if (!window.confirm(`Stop serving these docs at ${state.domain}?`)) return;
    const data = await call("remove", "DELETE", `/api/projects/${id}/domain`);
    if (data) setDomainInput("");
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", maxWidth: "1000px", gap: "24px 48px" }}>
      <div style={{ flex: "1 1 240px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#0f172a", margin: "0 0 8px 0" }}>Custom domain</h2>
        <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
          Serve these docs at your own domain, like docs.yourstartup.com. You prove you own it with a DNS record.
        </p>
      </div>

      <div style={{ flex: "1.5 1 360px", minWidth: 0 }}>
        {state.loading && <p style={{ color: "#64748b", fontSize: "14px" }}>Loading…</p>}
        {state.error && <p role="alert" style={{ color: "#b91c1c", fontSize: "14px" }}>{state.error}</p>}

        {!state.loading && !state.error && (
          <>
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff" }}>
                <span style={{ padding: "10px 12px", color: "#64748b", fontSize: "14px", borderRight: "1px solid #e2e8f0" }}>https://</span>
                <input data-testid="domain-input" type="text" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} placeholder="docs.yourstartup.com" style={{ flex: 1, minWidth: 0, padding: "10px 12px", border: "none", outline: "none", fontSize: "14px", color: "#0f172a" }} />
              </div>
              <button type="button" data-testid="domain-save" onClick={save} disabled={busy !== null || !domainInput.trim() || domainInput === state.domain} style={{ ...button(true), opacity: busy !== null || !domainInput.trim() || domainInput === state.domain ? 0.6 : 1 }}>
                {busy === "save" ? "Saving…" : state.domain ? "Change domain" : "Add domain"}
              </button>
            </div>

            {message && (
              <p role={message.kind === "error" ? "alert" : "status"} data-testid="domain-message" style={{ fontSize: "13px", color: message.kind === "error" ? "#b91c1c" : "#047857", margin: "0 0 16px 0" }}>{message.text}</p>
            )}

            {state.domain && (
              <div data-testid="domain-status" style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                  <strong style={{ fontSize: "14px", color: "#0f172a" }}>{state.domain}</strong>
                  <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 8px", borderRadius: "999px", backgroundColor: state.verified ? "#ecfdf5" : "#fffbeb", color: state.verified ? "#047857" : "#b45309" }}>
                    {state.verified ? "Verified" : "Waiting for DNS"}
                  </span>
                </div>

                {!state.verified && state.record && (
                  <>
                    <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 12px 0" }}>Add these records at your DNS provider, then click Verify.</p>
                    <div style={{ display: "grid", gap: "10px", marginBottom: "12px" }}>
                      <div>
                        <div style={label}>1. Ownership: TXT record</div>
                        <div style={mono}>Name: <span data-testid="txt-name">{state.record.name}</span><br />Value: <span data-testid="txt-value">{state.record.value}</span></div>
                      </div>
                      <div>
                        <div style={label}>2. Routing: CNAME record</div>
                        <div style={mono}>Name: {state.domain}<br />Target: {API_HOST}</div>
                      </div>
                    </div>
                  </>
                )}
                {state.verified && (
                  <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 12px 0" }}>
                    Your docs are served at <a href={`https://${state.domain}`} target="_blank" rel="noopener noreferrer">https://{state.domain}</a> once its CNAME points at {API_HOST} and HTTPS is set up on your host.
                  </p>
                )}

                <div style={{ display: "flex", gap: "8px" }}>
                  {!state.verified && <button type="button" data-testid="domain-verify" onClick={verify} disabled={busy !== null} style={button(true)}>{busy === "verify" ? "Checking…" : "Verify"}</button>}
                  <button type="button" onClick={remove} disabled={busy !== null} style={button(false)}>{busy === "remove" ? "Removing…" : "Remove domain"}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
