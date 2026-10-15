// The MDX components generated docs may use, and the props each one accepts.
//
// This is the single source of truth for:
//   - the critic's "allowed components" list (backend/aiEditor.js)
//   - the safe MDX compiler (backend/mdx/safeMdx.js): any other component is unwrapped
//     (its content is kept) and any other prop is dropped
//   - the docs viewer: every name here must be rendered by
//     frontend/src/components/mdx/registry.jsx (checked by backend/test/safeMdx.test.js)
//
// Prop values may only be plain data (strings, numbers, booleans, arrays, objects).
// Code in props or anywhere else in a page is removed before it reaches a browser.

const COMPONENTS = {
    // Callouts
    Note: [],
    Tip: [],
    Info: [],
    Warning: [],
    Danger: [],
    Check: [],
    Callout: ["title", "icon", "color"],

    // Structure
    Steps: [],
    Step: ["title"],
    Tabs: [],
    Tab: ["title"],
    AccordionGroup: [],
    Accordion: ["title", "icon"],
    CardGroup: ["cols"],
    Card: ["title", "icon", "href"],
    Expandable: ["title"],
    Frame: ["caption"],
    Update: ["label", "date"],

    // Inline
    Badge: ["type"],
    Tooltip: ["tip", "text"],

    // Code and API reference
    CodeGroup: [],
    CodeBlock: ["language", "title", "highlight"],
    ParamField: ["name", "type", "required", "default", "body", "query", "path", "header"],
    ResponseField: ["name", "type", "required"],
    RequestExample: [],
    ResponseExample: [],
    ApiPlayground: ["method", "endpoint"],
    CodeGenerator: ["method", "endpoint", "body"],
};

const COMPONENT_NAMES = Object.keys(COMPONENTS);

// Plain HTML elements allowed in docs (from markdown, or written as lowercase JSX).
// Anything else is unwrapped, keeping its text.
const HTML_ELEMENTS = {
    p: [], strong: [], em: [], del: [], code: ["className"], pre: [], blockquote: [], hr: [], br: [],
    h1: ["id"], h2: ["id"], h3: ["id"], h4: ["id"], h5: ["id"], h6: ["id"],
    ul: [], ol: ["start"], li: [], a: ["href", "title"], img: ["src", "alt", "title", "width", "height"],
    table: [], thead: [], tbody: [], tr: [], th: ["align"], td: ["align"],
    div: [], span: [], sup: [], sub: [], kbd: [], details: [], summary: [],
    input: ["type", "checked", "disabled"], // GitHub task-list checkboxes
};

// Props holding a link or image address; only safe schemes are allowed.
const URL_PROPS = new Set(["href", "src"]);

module.exports = { COMPONENTS, COMPONENT_NAMES, HTML_ELEMENTS, URL_PROPS };
