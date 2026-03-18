import { useState } from "react";

export default function VersionSelector() {
    const [version, setVersion] = useState("v1"); // Default 

    function handleChange(e) {
        const newVersion = e.target.value;
        setVersion(newVersion);

        window.dispatchEvent(
            new CustomEvent("version-change", { detail: newVersion })
        );
    }

    return (
        <select value={version} onChange={handleChange} style={{ marginBottom: '20px', padding: '5px' }}>
            <option value="v1">Version 1.0</option>
            <option value="v2">Version 2.0</option>
        </select>
    );
}