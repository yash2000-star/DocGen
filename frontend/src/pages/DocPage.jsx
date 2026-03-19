import { useEffect, useState } from "react";
import { useParams } from "react-router-dom"; // <-- Pull variables dynamically from the URL
import Prism from "prismjs";
import "prismjs/components/prism-javascript";

import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { 
  Note, Warning, Steps, Step, CodeBlock, Tabs, Tab, Card, CardGroup, Tip, 
  Info, Danger, Accordion, AccordionGroup, Badge, Callout, ParamField, 
  ResponseField, Expandable, Frame, CodeGroup, Table, Th, Td, Check, 
  Update, Tooltip, RequestExample, ResponseExample, ApiPlayground
} from "../components/mdx/MdxComponents";

// --- ADDED: Helper function to turn heading text into URL-safe IDs ---
function slugify(children) {
  // Recursively extract pure text from React children
  const getText = (node) => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(getText).join('');
    if (node && node.props && node.props.children) return getText(node.props.children);
    return '';
  };
  
  const text = getText(children);
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

export default function DocPage() {
  // Dynamic routing variables
  const { tenant, version } = useParams(); 

  const [MdxContent, setMdxContent] = useState(() => () => <h2>Loading document...</h2>);
  const [currentRoute, setCurrentRoute] = useState("index"); // Default to index.mdx

  // Listen for sidebar clicks to change the current document
  useEffect(() => {
    function handleDocChange(event) {
      const route = event.detail;
      if (!route)   return;
      setCurrentRoute(route);
    }

    window.addEventListener("doc-change", handleDocChange);
    return () => window.removeEventListener("doc-change", handleDocChange);
  }, []);

  // The Dynamic Fetch Engine
  useEffect(() => {
    // Safety check: if we don't have URL params, don't fetch
    if (!tenant || !version || !currentRoute) return;

    setMdxContent(() => () => <h2>Loading...</h2>);

    // Fetch the raw MDX from your Node.js backend
    fetch(`http://localhost:4000/api/static/${tenant}/${version}/${currentRoute}.mdx`)
      .then((res) => {
        if (!res.ok) throw new Error("Document not found");
        return res.text();
      })
      .then(async (mdxString) => {
        try {
          // Compile the raw text into live React components!
          const { default: CompiledComponent } = await evaluate(mdxString, {
            ...runtime,
          });

          setMdxContent(() => CompiledComponent);
        } catch (error) {
          console.error("MDX Compilation Error:", error);
          setMdxContent(() => () => (
            <div style={{ color: "red", padding: "20px" }}>Error rendering document. Check console.</div>
          ));
        }
      })
      .catch((error) => {
         console.error("Fetch Error:", error);
         setMdxContent(() => () => (
            <div style={{ padding: "20px", color: "var(--text-muted)" }}>Document not found: {currentRoute}</div>
         ));
      });
  }, [tenant, version, currentRoute]);

  // Highlight syntax whenever the content changes
  useEffect(() => {
    Prism.highlightAll();
  }, [MdxContent]);

  const mdxComponents = {
    Note, Warning, Steps, Step, CodeBlock, Tabs, Tab, Card, CardGroup, Tip, 
    Info, Danger, Accordion, AccordionGroup, Badge, Callout, ParamField, 
    ResponseField, Expandable, Frame, CodeGroup, table: Table, th: Th, 
    td: Td, Check, Update, Tooltip, RequestExample, ResponseExample, ApiPlayground,
    
    // --- ADDED: Overrides for headings to inject the generated IDs ---
    h1: ({ children, ...props }) => <h1 id={slugify(children)} style={{ marginTop: '40px', scrollMarginTop: '80px' }} {...props}>{children}</h1>,
    h2: ({ children, ...props }) => <h2 id={slugify(children)} style={{ marginTop: '40px', scrollMarginTop: '80px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }} {...props}>{children}</h2>,
    h3: ({ children, ...props }) => <h3 id={slugify(children)} style={{ marginTop: '32px', scrollMarginTop: '80px' }} {...props}>{children}</h3>,
    h4: ({ children, ...props }) => <h4 id={slugify(children)} style={{ marginTop: '24px', scrollMarginTop: '80px' }} {...props}>{children}</h4>,
  };

  return (
    <div className="mdx-content">
      <MdxContent components={mdxComponents} />
    </div>
  );
}