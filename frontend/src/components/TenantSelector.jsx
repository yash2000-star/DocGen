import { useState } from "react";

export default function TenantSelector() {
    const [tenant, setTenant] = useState("company-a");

    function handleChange(e) {
        const newTenant = e.target.value;
        setTenant(newTenant);

        window.dispatchEvent(
            new CustomEvent("tenant-change", { detail: newTenant })
        );
        window.dispatchEvent(
            new CustomEvent("version-change", { detail: "v1" })
        )
    }

    return (
        <select 
            value={tenant} 
            onChange={handleChange} 
            style={{ marginBottom: '10px', padding: '5px', width: '100%' }}
        >
            <option value="company-a">Company A</option>
            <option value="company-b">Company B</option>
        </select>
    );
}