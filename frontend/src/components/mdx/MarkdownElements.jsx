// Styled versions of the plain HTML elements in docs pages (headings, paragraphs, lists...).
import { createElement } from "react";
import CodeBlock from "./CodeBlock";

// Fallback heading id when the server didn't provide one.
function slugify(children) {
  const getText = (node) => {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(getText).join("");
    if (node?.props?.children) return getText(node.props.children);
    return "";
  };
  return getText(children).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

const headingClasses = {
  h1: "text-3xl font-bold mt-10 mb-4 text-slate-900 dark:text-slate-100 scroll-mt-20 block",
  h2: "text-2xl font-semibold mt-10 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 scroll-mt-20 block",
  h3: "text-xl font-medium mt-8 mb-3 text-slate-900 dark:text-slate-100 scroll-mt-20 block",
  h4: "text-lg font-medium mt-6 mb-2 text-slate-900 dark:text-slate-100 scroll-mt-20 block",
};

const heading = (tag) => function Heading({ children, id, ...props }) {
  return createElement(tag, { id: id || slugify(children), className: headingClasses[tag], ...props }, children);
};

export const H1 = heading("h1");
export const H2 = heading("h2");
export const H3 = heading("h3");
export const H4 = heading("h4");

export const P = (props) => <p className="text-slate-700 dark:text-slate-300 leading-7 mb-4" {...props} />;
export const Ul = (props) => <ul className="list-disc pl-6 mb-4 text-slate-700 dark:text-slate-300 space-y-2" {...props} />;
export const Ol = (props) => <ol className="list-decimal pl-6 mb-4 text-slate-700 dark:text-slate-300 space-y-2" {...props} />;
export const A = (props) => <a className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 decoration-blue-500/30 hover:decoration-blue-500/100 transition-colors" {...props} />;

// Inline `code`. Fenced code blocks arrive as <CodeBlock> from the compiler.
export const InlineCode = ({ className, children, ...props }) => {
  if (className?.startsWith("language-") && typeof children === "string") {
    return <CodeBlock language={className.replace("language-", "")}>{children}</CodeBlock>;
  }
  return <code className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-slate-200 dark:border-slate-700" {...props}>{children}</code>;
};

export const Pre = (props) => <pre className="p-4 bg-slate-900 rounded-xl my-4 overflow-x-auto text-sm" {...props} />;
