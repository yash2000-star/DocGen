import { useCallback, useEffect, useState } from "react";
import { KeyRound, Check, TriangleAlert, Trash2, RefreshCw, Star, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { apiFetch } from "../../lib/api";

// Reads a JSON response and throws the API's { error: { message } } as an Error.
async function readJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error?.message || `Request failed (HTTP ${res.status}).`);
    error.detail = data?.error?.providerMessage;
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}

const styles = {
  card: { backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px 24px", marginBottom: "12px" },
  label: { display: "block", fontSize: "13px", fontWeight: "500", color: "#0f172a", marginBottom: "6px" },
  hint: { fontSize: "12px", color: "#64748b", margin: "6px 0 0 0" },
  input: { width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", color: "#0f172a", backgroundColor: "#ffffff", boxSizing: "border-box", outline: "none" },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", backgroundColor: "#0f172a", color: "#ffffff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "500", cursor: "pointer" },
  secondaryBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 12px", backgroundColor: "#ffffff", color: "#334155", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", fontWeight: "500", cursor: "pointer" },
  dangerBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 12px", backgroundColor: "#ffffff", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "13px", fontWeight: "500", cursor: "pointer" },
  badge: (color, bg) => ({ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: "600", color, backgroundColor: bg, padding: "2px 8px", borderRadius: "999px" }),
};

function Message({ kind, title, detail }) {
  const palette = kind === "error"
    ? { color: "#b91c1c", bg: "#fef2f2", border: "#fecaca", Icon: TriangleAlert }
    : kind === "warning"
      ? { color: "#92400e", bg: "#fffbeb", border: "#fde68a", Icon: TriangleAlert }
      : { color: "#047857", bg: "#ecfdf5", border: "#a7f3d0", Icon: Check };
  return (
    <div role={kind === "error" ? "alert" : "status"} style={{ display: "flex", gap: "8px", padding: "10px 12px", borderRadius: "8px", border: `1px solid ${palette.border}`, backgroundColor: palette.bg, color: palette.color, fontSize: "13px", marginTop: "12px" }}>
      <palette.Icon size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
      <div>
        <div>{title}</div>
        {detail && <div style={{ marginTop: "4px", opacity: 0.8, fontSize: "12px", wordBreak: "break-word" }}>{detail}</div>}
      </div>
    </div>
  );
}

function ProviderCard({ provider, credential, onChanged }) {
  const connected = Boolean(credential);
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [writerModel, setWriterModel] = useState("");
  const [criticModel, setCriticModel] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [models, setModels] = useState([]);
  const [busy, setBusy] = useState(null); // "save" | "test" | "remove" | "default" | "models"
  const [message, setMessage] = useState(null);

  const loadModels = useCallback(async () => {
    setBusy("models");
    try {
      const data = await readJson(await apiFetch(`/api/ai/credentials/${provider.id}/models`));
      setModels(data.models);
    } catch (error) {
      setMessage({ kind: "error", title: `Couldn't load models: ${error.message}`, detail: error.detail });
    } finally {
      setBusy(null);
    }
  }, [provider.id]);

  const startEditing = () => {
    setApiKey("");
    setBaseUrl(credential?.baseUrl || provider.baseUrl || "");
    setWriterModel(credential?.writerModel || provider.defaultModels.writer || "");
    setCriticModel(credential?.criticModel || provider.defaultModels.critic || "");
    setMakeDefault(false);
    setMessage(null);
    setOpen(true);
    // Once a provider is connected, offer its live model list in the pickers.
    if (connected && models.length === 0) loadModels();
  };

  const run = async (kind, request, onSuccess) => {
    setBusy(kind);
    setMessage(null);
    try {
      const data = await readJson(await request());
      await onSuccess(data);
    } catch (error) {
      setMessage({ kind: "error", title: error.message, detail: error.detail });
    } finally {
      setBusy(null);
    }
  };

  const save = (e) => {
    e.preventDefault();
    run("save", () => apiFetch(`/api/ai/credentials/${provider.id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(provider.baseUrlEditable ? { baseUrl: baseUrl.trim() } : {}),
        writerModel: writerModel.trim(),
        criticModel: criticModel.trim(),
        makeDefault,
      }),
    }), async (data) => {
      setApiKey("");
      await onChanged();
      if (data.unavailableModels?.length) {
        setMessage({ kind: "warning", title: `Saved, but this key can't use: ${data.unavailableModels.join(", ")}. Choose a model from the list.` });
      } else {
        setMessage({ kind: "success", title: `Connected. DocGen tested the key with ${provider.label}.` });
        setOpen(false);
      }
    });
  };

  const test = () => run("test", () => apiFetch(`/api/ai/credentials/${provider.id}/test`, { method: "POST" }), async (data) => {
    await onChanged();
    setMessage(data.unavailableModels?.length
      ? { kind: "warning", title: `The key works, but it can't use: ${data.unavailableModels.join(", ")}.` }
      : { kind: "success", title: "The key works." });
  });

  const setAsDefault = () => run("default", () => apiFetch(`/api/ai/credentials/${provider.id}/default`, { method: "POST" }), onChanged);

  const remove = () => {
    if (!window.confirm(`Remove your ${provider.label} key? DocGen will stop using it.`)) return;
    run("remove", () => apiFetch(`/api/ai/credentials/${provider.id}`, { method: "DELETE" }), async () => {
      setOpen(false);
      setModels([]);
      await onChanged();
    });
  };

  const modelOptions = [...new Set([...provider.suggestedModels, ...models.map((m) => m.id)])];
  const listId = `models-${provider.id}`;
  const spinner = (kind) => busy === kind && <LoaderCircle size={14} style={{ animation: "spin 1s linear infinite" }} />;

  return (
    <div style={styles.card} data-provider={provider.id}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a" }}>{provider.label}</span>
            {connected && credential.isDefault && <span style={styles.badge("#1d4ed8", "#eff6ff")}><Star size={11} /> Default</span>}
            {connected && credential.lastTestOk === false && <span style={styles.badge("#b45309", "#fffbeb")}>Needs attention</span>}
            {connected && credential.lastTestOk !== false && <span style={styles.badge("#047857", "#ecfdf5")}><Check size={11} /> Connected</span>}
          </div>
          <p style={{ ...styles.hint, marginTop: "4px" }}>
            {connected
              ? <>{credential.hasKey ? <>Key ending <code>{credential.keyHint || "••••"}</code> · </> : null}Writer <code>{credential.writerModel}</code> · Critic <code>{credential.criticModel}</code></>
              : provider.keyRequired ? "Not connected" : "Not connected · no key needed for self-hosted models"}
          </p>
        </div>
        {!open && (
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            {connected && !credential.isDefault && (
              <button type="button" style={styles.secondaryBtn} onClick={setAsDefault} disabled={Boolean(busy)}>{spinner("default")} Make default</button>
            )}
            <button type="button" style={connected ? styles.secondaryBtn : styles.primaryBtn} onClick={startEditing}>
              {connected ? "Edit" : "Connect"}
            </button>
          </div>
        )}
      </div>

      {open && (
        <form onSubmit={save} style={{ marginTop: "20px", borderTop: "1px solid #f1f5f9", paddingTop: "20px", display: "grid", gap: "16px" }}>
          <div>
            <label style={styles.label} htmlFor={`key-${provider.id}`}>API key{provider.keyRequired ? "" : " (optional)"}</label>
            <input
              id={`key-${provider.id}`}
              type="password"
              autoComplete="off"
              style={styles.input}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={credential?.hasKey ? `Saved key ending ${credential.keyHint || "••••"}. Leave blank to keep it.` : provider.keyPlaceholder}
            />
            {provider.keyUrl && (
              <p style={styles.hint}>
                <a href={provider.keyUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  Get a {provider.label} key <ExternalLink size={11} />
                </a>
              </p>
            )}
          </div>

          {provider.baseUrlEditable && (
            <div>
              <label style={styles.label} htmlFor={`url-${provider.id}`}>Base URL</label>
              <input id={`url-${provider.id}`} type="url" style={styles.input} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://your-server.example.com/v1" required />
              <p style={styles.hint}>The OpenAI-compatible API root, usually ending in <code>/v1</code>.</p>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={styles.label} htmlFor={`writer-${provider.id}`}>Writer model</label>
              <input id={`writer-${provider.id}`} list={listId} style={styles.input} value={writerModel} onChange={(e) => setWriterModel(e.target.value)} placeholder="Model ID" required />
              <p style={styles.hint}>Plans the site and writes each page.</p>
            </div>
            <div>
              <label style={styles.label} htmlFor={`critic-${provider.id}`}>Critic model</label>
              <input id={`critic-${provider.id}`} list={listId} style={styles.input} value={criticModel} onChange={(e) => setCriticModel(e.target.value)} placeholder="Same as writer" />
              <p style={styles.hint}>Reviews drafts against your code.</p>
            </div>
            <datalist id={listId}>
              {modelOptions.map((id) => <option key={id} value={id} />)}
            </datalist>
          </div>
          {connected && (
            <button type="button" style={{ ...styles.secondaryBtn, justifySelf: "start" }} onClick={loadModels} disabled={Boolean(busy)}>
              {spinner("models") || <RefreshCw size={13} />} Refresh model list
            </button>
          )}

          {!credential?.isDefault && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#334155" }}>
              <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
              Use this provider by default
            </label>
          )}

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="submit" style={styles.primaryBtn} disabled={Boolean(busy)}>{spinner("save")} Save and test</button>
            {connected && <button type="button" style={styles.secondaryBtn} onClick={test} disabled={Boolean(busy)}>{spinner("test")} Test again</button>}
            <button type="button" style={styles.secondaryBtn} onClick={() => { setOpen(false); setMessage(null); }} disabled={Boolean(busy)}>Cancel</button>
            {connected && <button type="button" style={{ ...styles.dangerBtn, marginLeft: "auto" }} onClick={remove} disabled={Boolean(busy)}>{spinner("remove") || <Trash2 size={13} />} Remove</button>}
          </div>
        </form>
      )}

      {message && <Message {...message} />}
    </div>
  );
}

export default function AiProviders() {
  const [catalog, setCatalog] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const loadCredentials = useCallback(async () => {
    const data = await readJson(await apiFetch("/api/ai/credentials"));
    setCredentials(data.credentials);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await readJson(await apiFetch("/api/ai/providers"));
        setCatalog(data);
        if (data.enabled) await loadCredentials();
      } catch (error) {
        setLoadError(error.message);
      }
    })();
  }, [loadCredentials]);

  return (
    <div style={{ maxWidth: "820px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <KeyRound size={26} color="#0f172a" />
        <h2 style={{ fontSize: "24px", fontWeight: "600", color: "#0f172a", margin: 0 }}>AI providers</h2>
      </div>
      <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 8px 0" }}>
        DocGen writes your documentation with your own AI account. Connect a provider, then choose which models write and review your pages.
      </p>
      <p style={{ display: "flex", alignItems: "center", gap: "6px", color: "#64748b", fontSize: "13px", margin: "0 0 28px 0" }}>
        <ShieldCheck size={14} color="#059669" /> Keys are encrypted on the server and never shown again after you save them.
      </p>

      {loadError && <Message kind="error" title={`Couldn't load AI settings: ${loadError}`} />}
      {catalog && !catalog.enabled && (
        <Message kind="warning" title="Saving AI keys isn't enabled on this server yet." detail="The administrator needs to set AI_KEY_ENCRYPTION_KEY in backend/.env and restart the backend." />
      )}
      {!catalog && !loadError && <p style={{ color: "#64748b", fontSize: "14px" }}>Loading…</p>}

      {catalog?.enabled && catalog.providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          credential={credentials.find((c) => c.provider === provider.id)}
          onChanged={loadCredentials}
        />
      ))}
    </div>
  );
}
