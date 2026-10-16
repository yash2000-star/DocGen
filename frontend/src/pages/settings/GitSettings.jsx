import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../lib/api";

const API_URL = import.meta.env.VITE_API_URL;

const rowStyle = { display: "flex", flexWrap: "wrap", gap: "24px 48px", borderBottom: "1px solid #e2e8f0", paddingBottom: "32px", marginBottom: "32px" };
const leftColStyle = { flex: "0 1 240px", minWidth: "200px" };
const h4Style = { fontSize: "14px", fontWeight: "600", color: "#0f172a", margin: "0 0 4px 0" };
const subStyle = { fontSize: "13px", color: "#64748b", margin: 0, lineHeight: "1.5" };
const fieldStyle = { display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", maxWidth: "520px", marginBottom: "12px" };
const valueStyle = { flex: 1, minWidth: 0, backgroundColor: "#f8fafc", padding: "10px 14px", fontSize: "13px", color: "#0f172a", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const fieldButtonStyle = { flexShrink: 0, padding: "10px 14px", backgroundColor: "#ffffff", border: "none", borderLeft: "1px solid #e2e8f0", fontSize: "13px", fontWeight: "500", color: "#475569", cursor: "pointer" };

function CopyField({ label, value, secret, testId }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>{label}</div>
      <div style={fieldStyle}>
        <div data-testid={testId} style={valueStyle}>{shown ? value : "•".repeat(32)}</div>
        {secret && <button type="button" onClick={() => setShown(!shown)} style={fieldButtonStyle}>{shown ? "Hide" : "Reveal"}</button>}
        <button type="button" onClick={copy} style={{ ...fieldButtonStyle, color: copied ? "#10b981" : "#475569" }}>{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}

// Push-to-update: the GitHub webhook that regenerates pages for changed files.
// Each project has its own secret; only project admins can see or rotate it.
export default function GitSettings() {
  const { id } = useParams();
  const [state, setState] = useState({ status: "loading" });
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/projects/${id}/webhook`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setState(res.ok ? { status: "ready", secret: data.secret } : { status: "error", error: data.error || `HTTP ${res.status}` });
      })
      .catch(() => !cancelled && setState({ status: "error", error: "Couldn't reach the server." }));
    return () => { cancelled = true; };
  }, [id]);

  const rotate = async () => {
    if (!window.confirm("Create a new secret? Pushes signed with the old one will be refused until you update the webhook on GitHub.")) return;
    setRotating(true);
    const res = await apiFetch(`/api/projects/${id}/webhook/rotate`, { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setRotating(false);
    if (res?.ok) setState({ status: "ready", secret: data.secret, rotated: true });
    else setState((s) => ({ ...s, error: data?.error || "Couldn't create a new secret." }));
  };

  return (
    <div style={{ maxWidth: "900px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={rowStyle}>
        <div style={leftColStyle}>
          <h4 style={h4Style}>Update docs on every push</h4>
          <p style={subStyle}>When you push to GitHub, DocGen rewrites the pages for the files you changed, using your AI provider.</p>
        </div>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          {state.status === "loading" && <p style={subStyle}>Loading…</p>}
          {state.status === "error" && <p role="alert" style={{ ...subStyle, color: "#b91c1c" }}>{state.error}</p>}
          {state.status === "ready" && (
            <>
              <CopyField label="Payload URL" value={`${API_URL}/api/webhook`} testId="webhook-url" />
              <CopyField label="Secret" value={state.secret} secret testId="webhook-secret" />
              {state.rotated && <p style={{ ...subStyle, color: "#059669", marginBottom: "12px" }}>New secret created. Paste it into the webhook on GitHub.</p>}
              {state.error && <p role="alert" style={{ ...subStyle, color: "#b91c1c", marginBottom: "12px" }}>{state.error}</p>}
              <ol style={{ ...subStyle, paddingLeft: "18px", margin: "16px 0" }}>
                <li>On GitHub, open the repository's <strong>Settings → Webhooks → Add webhook</strong>.</li>
                <li>Paste the payload URL and the secret above. Content type: <code>application/json</code>.</li>
                <li>Choose <strong>Just the push event</strong> and save.</li>
              </ol>
              <p style={subStyle}>Keep the secret private: anyone who has it can trigger updates that use your AI credits.</p>
              <button type="button" data-testid="rotate-webhook-secret" onClick={rotate} disabled={rotating} style={{ marginTop: "16px", padding: "8px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", fontWeight: 500, color: "#0f172a", cursor: rotating ? "default" : "pointer" }}>
                {rotating ? "Creating…" : "Create a new secret"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
