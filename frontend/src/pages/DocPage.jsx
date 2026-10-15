import { useEffect, useState } from "react";
import { useParams } from "react-router-dom"; 
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import DOMPurify from 'isomorphic-dompurify';
import Breadcrumbs from "../components/mdx/Breadcrumbs";

import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { 
  Note, Warning, Steps, Step, CodeBlock, Tabs, Tab, Card, CardGroup, Tip, 
  Info, Danger, Accordion, AccordionGroup, Badge, Callout, ParamField, 
  ResponseField, Expandable, Frame, CodeGroup, Table, Th, Td, Check, 
  Update, Tooltip, RequestExample, ResponseExample, ApiPlayground, CodeGenerator
} from "../components/mdx/MdxComponents";

// Helper function to turn heading text into URL-safe IDs
function slugify(children) {
  const getText = (node) => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(getText).join('');
    if (node && node.props && node.props.children) return getText(node.props.children);
    return '';
  };
  
  const text = getText(children);
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

// --- NEW: Accept the custom props from DocEngine! ---
export default function DocPage({ customTenant, customVersion, defaultRoute }) {
  const params = useParams(); 

  // THE MAGIC TRICK: Use the custom domain props, otherwise use the URL!
  const tenant = customTenant || params.tenant;
  const version = customVersion || params.version;
  
  // Read the wildcard/splat parameter to determine which file to fetch.
  // If no path is provided (e.g., they just visited /docs/tenant/v1), open the first
  // page from docs.json navigation. defaultRoute is null while docs.json is loading.
  const currentRoute = params["*"] || defaultRoute;

  const [MdxContent, setMdxContent] = useState(() => () => <h2>Loading document...</h2>);

  // The Dynamic Fetch Engine
  useEffect(() => {
    // Safety check: if we don't have tenant or version, don't fetch
    if (!tenant || !version || !currentRoute) return;

    setMdxContent(() => () => <h2>Loading...</h2>);

    // Fetch the raw MDX from your new Node.js dynamic route
    const API_URL = import.meta.env.VITE_API_URL;
    fetch(`${API_URL}/api/docs/${tenant}/${version}/${currentRoute}`)
      .then((res) => {
        if (!res.ok) throw new Error("Document not found");
        return res.text();
      })
      .then(async (mdxString) => {
        try {
          // We removed DOMPurify here because it destroys React JSX objects like body={{ "name": "Yash" }}
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
    td: Td, Check, Update, Tooltip, RequestExample, ResponseExample, ApiPlayground, CodeGenerator,
    
    // Fallbacks for lower-case tags
    note: Note, warning: Warning, info: Info, tip: Tip, danger: Danger, card: Card,
    tabs: Tabs, tab: Tab, expandable: Expandable, frame: Frame,
    
    // Standard markdown elements
    pre: ({ children, ...rest }) => {
      // When MDX compiles ```code```, it produces <pre><code className="language-xxx">...</code></pre>
      // With our components map, child.type is the mapped code function, NOT the string 'code'.
      // So we check child.props instead.
      if (children?.props) {
        const className = children.props.className || '';
        const language = className.replace(/language-/, '') || 'text';
        const code = children.props.children;
        if (typeof code === 'string') {
          return <CodeBlock language={language}>{code}</CodeBlock>;
        }
      }
      return <pre className="p-4 bg-slate-900 rounded-xl my-4 overflow-x-auto text-sm" {...rest}>{children}</pre>;
    },
    code: (props) => <code className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-slate-200 dark:border-slate-700" {...props} />,
    
    // Headings mapped with Tailwind
    h1: ({ children, ...props }) => <h1 id={slugify(children)} className="text-3xl font-bold mt-10 mb-4 text-slate-900 dark:text-slate-100 scroll-mt-20 block" {...props}>{children}</h1>,
    h2: ({ children, ...props }) => <h2 id={slugify(children)} className="text-2xl font-semibold mt-10 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 scroll-mt-20 block" {...props}>{children}</h2>,
    h3: ({ children, ...props }) => <h3 id={slugify(children)} className="text-xl font-medium mt-8 mb-3 text-slate-900 dark:text-slate-100 scroll-mt-20 block" {...props}>{children}</h3>,
    h4: ({ children, ...props }) => <h4 id={slugify(children)} className="text-lg font-medium mt-6 mb-2 text-slate-900 dark:text-slate-100 scroll-mt-20 block" {...props}>{children}</h4>,
    p: (props) => <p className="text-slate-700 dark:text-slate-300 leading-7 mb-4" {...props} />,
    ul: (props) => <ul className="list-disc pl-6 mb-4 text-slate-700 dark:text-slate-300 space-y-2" {...props} />,
    ol: (props) => <ol className="list-decimal pl-6 mb-4 text-slate-700 dark:text-slate-300 space-y-2" {...props} />,
    a: (props) => <a className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 decoration-blue-500/30 hover:decoration-blue-500/100 transition-colors" {...props} />
  };

  return (
    <div className="mdx-content">
      <Breadcrumbs path={currentRoute} />
      <div className="pb-24">
        <MdxContent components={mdxComponents} />
      </div>
    </div>
  );
}