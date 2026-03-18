import { useEffect, useState } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";

import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { Note, Warning, Steps, Step, CodeBlock, Tabs, Tab, Card, CardGroup, Tip, Info, Danger, Accordion, AccordionGroup, Badge, Callout, ParamField, ResponseField, Expandable, Frame, CodeGroup, Table, Th, Td, Check, Update, Tooltip , RequestExample, ResponseExample} from "../components/mdx/MdxComponents";

export default function DocPage() {
  const [MdxContent, setMdxContent] = useState(() => () => <h2>Select a document</h2>);
  const [currentVersion, setCurrentVersion] = useState("dev-tinder-backend");
  const [currentTenant, setCurrentTenant] = useState("yash");

  useEffect(() => {
    function handleVersionChange(event) {
      setCurrentVersion(event.detail);
      setMdxContent(() => () => <h2>Select a document</h2>);
    }
    window.addEventListener("version-change", handleVersionChange);
    return () => window.removeEventListener("version-change", handleVersionChange);
  }, []);

  useEffect(() => {
    function handleTenantChange(event) {
      setCurrentTenant(event.detail);
      setMdxContent(() => () => <h2>Select a document</h2>); 
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

      fetch(`http://localhost:4000/api/static/${currentTenant}/${currentVersion}/${route}.mdx`)
        .then((res) => {
          if (!res.ok) throw new Error("Document not found");
          return res.text()
        })
        .then(async (mdxString) => {
          try {
            const { default: CompiledComponent } = await evaluate(mdxString, {
              ...runtime,
            });

            setMdxContent(() => CompiledComponent);
          } catch (error) {
            console.error ("MDX Compilation Error:", error);
            setMdxContent(() => () => (
              <div style={{ color: "red" }}>Error rendering document. Check console.</div>
            ))
          }
        })
    }

    window.addEventListener("doc-change", handleDocChange);

    return () => {
      window.removeEventListener("doc-change", handleDocChange);
    };
  }, [currentTenant, currentVersion]);

  useEffect(() => {
        Prism.highlightAll();
    }, [MdxContent]);

    const mdxComponents = {
    Note,
    Warning,
    Steps,
    Step,
    CodeBlock,
    Tabs,
    Tab,
    Card,
    CardGroup,
    Tip,
    Info,
    Danger,
    Accordion,
    AccordionGroup,
    Badge,
    Callout,
    ParamField,
    ResponseField,
    Expandable,
    Frame,
    CodeGroup,
    table: Table,
    th: Th,
    td: Td,
    Check,
    Update,
    Tooltip,
    RequestExample,
    ResponseExample
  };

 return (
    <div className="mdx-content">
      <MdxContent components={mdxComponents} />
    </div>
  );
}
