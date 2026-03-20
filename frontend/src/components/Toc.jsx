import { useEffect, useState } from "react";
import { useParams } from "react-router-dom"; // <-- Dynamic URL variables

export default function Toc() {
    const { tenant, version } = useParams();
    const [toc, setToc] = useState([]);
    const [activeRoute, setActiveRoute] = useState("index");

    // Listen for the current document changing
    useEffect(() => {
        function handleDocChange(event) {
            if (event.detail) setActiveRoute(event.detail);
        }
        window.addEventListener("doc-change", handleDocChange);
        return () => window.removeEventListener("doc-change", handleDocChange);
    }, []);

    // Fetch the specific TOC file when the route changes
    useEffect(() => {
        if (!tenant || !version || !activeRoute) return;

        const cleanRoute = activeRoute.replace(/\//g, "_");

        const API_URL = import.meta.env.VITE_API_URL;
        
        fetch(`${API_URL}/api/static/toc/${tenant}_${version}_${cleanRoute}.json`)
        .then(res => {
            if (!res.ok) throw new Error("TOC not found");
            return res.json();
        })
        .then(data => setToc(data))
        .catch(err => {
            console.log("No TOC found for this page.");
            setToc([]);
        });
    }, [tenant, version, activeRoute]);

    if (toc.length === 0) return null; // Don't show anything if no headings

    return (
        <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: "16px" }}>
            <h4 style={{ 
                fontSize: "12px", 
                fontWeight: "600", 
                color: "#0f172a", 
                textTransform: "uppercase", 
                letterSpacing: "0.5px",
                marginBottom: "12px",
                marginTop: 0
            }}>
                On this page
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {toc.map((item, index) => (
                    <a 
                        key={index}
                        href={`#${item.id}`}
                        style={{
                            marginLeft: `${(item.level - 1) * 12}px`,
                            textDecoration: "none",
                            fontSize: "13px",
                            color: "#64748b",
                            transition: "color 0.2s",
                            lineHeight: "1.4"
                        }}
                        onClick={(e) => {
                            e.preventDefault(); 
                            const element = document.getElementById(item.id);
                            if (element) {
                                element.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = "var(--primary-brand)"}
                        onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}
                    >
                        {item.text}
                    </a>
                ))}
            </div>
        </div>
    )
}