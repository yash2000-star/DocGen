import React, {useState} from "react";

const GithubImporter = () => {
    const [repoUrl, setRepoUrl] = useState("");
    const [projectName, setProjectName] = useState("");
    const [tenantName, setTenant] = useState("yash");

    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    const handleGenerateDocs = async (e) => {
        e.preventDefault();

        if (!repoUrl || !projectName || !tenantName) {
            setStatusMessage("Please fill out all the fileds. ");
            return;
        }

        setIsLoading(true);
        setStatusMessage("Downloading code and generating AI docs... Please wait.");

        try {
            const response = await fetch("http://localhost:4000/api/github", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    repoUrl: repoUrl,
                    projectName: projectName,
                    tenantName: tenantName
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setStatusMessage(`Success! Generated and saved ${data.filesProcessed} Marrkdown files.`);
                setRepoUrl("");
                setProjectName("");
            } else {
                setStatusMessage(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Fetch error:", error);
            setStatusMessage("Failed to connect to the backend server.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
    <div style={{ padding: "20px", maxWidth: "500px", border: "1px solid #ccc", borderRadius: "8px", margin: "20px" }}>
      <h2>🚀 Import GitHub Repository</h2>
      <p style={{ fontSize: "14px", color: "#666" }}>
        Paste a public GitHub link, and our AI will automatically generate and publish the documentation.
      </p>

      <form onSubmit={handleGenerateDocs} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        
        <input 
          type="text" 
          placeholder="GitHub URL (e.g., https://github.com/yash2000-star/to-do-list)" 
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
        />

        <input 
          type="text" 
          placeholder="Project Name (e.g., to-do-list)" 
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
        />

        <input 
          type="text" 
          placeholder="Tenant Name (e.g., yash)" 
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
          style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
        />

        <button 
          type="submit" 
          disabled={isLoading}
          style={{ 
            padding: "12px", 
            backgroundColor: isLoading ? "#999" : "#007BFF", 
            color: "white", 
            border: "none", 
            borderRadius: "4px",
            cursor: isLoading ? "not-allowed" : "pointer",
            fontWeight: "bold"
          }}
        >
          {isLoading ? "Generating Docs..." : "Generate Documentation"}
        </button>

      </form>

      {/* This is where we display the success or error message to the user */}
      {statusMessage && (
        <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
          <strong>{statusMessage}</strong>
        </div>
      )}
    </div>
  );
}

export default GithubImporter;