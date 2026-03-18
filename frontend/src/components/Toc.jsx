import { useEffect, useState } from "react";

export default function Toc() {
    const [toc, setToc] = useState([]);
    const [currentVersion, setCurrentVersion] = useState("v1");
    const [currentTenant, setCurrentTenant] = useState("company-a"); 

    useEffect(() => {
        function handleVersionChange(event) {
            setCurrentVersion(event.detail);
            setToc([]);
        }
        window.addEventListener("version-change", handleVersionChange);
        return () => window.removeEventListener("version-change", handleVersionChange);
    }, []);

    useEffect(() => {
        function handleTenantChange(event) {
            setCurrentTenant(event.detail);
            setToc([]);
        }
        window.addEventListener("tenant-change", handleTenantChange);
        return () => window.removeEventListener("tenant-change", handleTenantChange);
    }, []);

    useEffect(() => {
        function handleDocChange(event) {
            const route = event.detail;

            if (!route) {
                console.log("Ignored empty route!");
                return; 
            }

            const tocFile = `${currentTenant}_${currentVersion}_${route.replace(/\//g, "_")}`;

            fetch(`/toc/${tocFile}.json`)
            .then(res => res.json())
            .then(data => {
                setToc(data);
            })
            .catch(err => {
                console.log("No TOC found for this page.");
                setToc([]);
            });
        }

        window.addEventListener("doc-change", handleDocChange);

        return () => {
            window.removeEventListener("doc-change", handleDocChange);
        };
    }, [currentTenant, currentVersion]);

    return (
        <div>
            <h4>On this page</h4>

            {toc.map((item, index) => (
                <div 
                key={index}
                style={{
                    marginLeft: `${(item.level - 1) * 10}px`
                }}
                >
                    <a 
                        href={`#${item.id}`}

                        onClick={(e) => {
                            e.preventDefault(); 
                            const element = document.getElementById(item.id);
                            if (element) {
                                element.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                        }}
                    >
                        {item.text}
                    </a>
                </div>
            ))}
        </div>
    )
}