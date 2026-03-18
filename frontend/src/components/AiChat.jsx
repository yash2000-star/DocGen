import { useState } from "react";

export default function AiChat() {
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const tenant ="company-a";
    const version = "v1";

    async function askAI() {
        if (!question) return;

        setIsLoading(true);
        setAnswer("");

        try {
            const res = await fetch("http://localhost:4000/api/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({ question, tenant, version })
            });

            const data = await res.json();

            if(data.error) {
                setAnswer("Error: " + data.error);
            } else {
                setAnswer(data.answer);
            }
        } catch (error) {
            setAnswer("Warning: Could not connect to the backend server. ");
        } finally {
            setIsLoading(false);
        }
    }

    return (
    <div style={{ marginTop: "30px", padding: "15px", border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "#f9fafb" }}>
      <h3 style={{ marginTop: 0, color: "#333", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        ✨ Ask AI Assistant
      </h3>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="E.g., How do I reset my password?"
        style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", marginBottom: "10px", resize: "none", fontSize: "14px" }}
        rows="3"
      />

      <button 
        onClick={askAI} 
        disabled={isLoading || !question}
        style={{ width: "100%", padding: "10px", backgroundColor: isLoading ? "#9ca3af" : "#000", color: "#fff", border: "none", borderRadius: "6px", cursor: isLoading ? "not-allowed" : "pointer", fontWeight: "bold" }}
      >
        {isLoading ? "Searching Docs..." : "Ask Question"}
      </button>

      {/* This box only appears if the AI has an answer */}
      {answer && (
        <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "14px", lineHeight: "1.5", color: "#374151" }}>
          <strong>Answer:</strong>
          <p style={{ margin: "5px 0 0 0", whiteSpace: "pre-wrap" }}>{answer}</p>
        </div>
      )}
    </div>
  );
}
