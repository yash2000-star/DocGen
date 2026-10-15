// Small helpers for cleaning up model output.

// Removes a ```json / ```mdx wrapper the model sometimes adds around raw output.
function stripCodeFence(text) {
    let trimmed = String(text || "").trim();
    if (trimmed.startsWith("```")) {
        trimmed = trimmed.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "").trim();
    }
    return trimmed;
}

module.exports = { stripCodeFence };
