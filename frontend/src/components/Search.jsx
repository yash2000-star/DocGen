export default function Search() {
  function openSearchModal() {
    window.dispatchEvent(new CustomEvent("open-search"));
  }

  return (
    <div style={{ marginBottom: "20px" }}>
      <button
        onClick={openSearchModal}
        style={{
          width: "100%",
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#f1f5f9",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          color: "#64748b",
          fontSize: "14px",
          cursor: "pointer",
          transition: "border-color 0.2s"
        }}
        onMouseOver={(e) => (e.currentTarget.style.borderColor = "#cbd5e1")}
        onMouseOut={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          🔍 Search...
        </span>
        <span style={{ 
          fontSize: "12px", 
          backgroundColor: "#e2e8f0", 
          padding: "2px 6px", 
          borderRadius: "4px",
          fontWeight: "600"
        }}>
          Cmd K
        </span>
      </button>
    </div>
  );
}