// Every component a docs page may use, by the name pages use for it.
// Must cover every name in backend/mdx/components.js (a backend test checks this).
import {
  Note, Warning, Steps, Step, CodeBlock, Tabs, Tab, Card, CardGroup, Tip,
  Info, Danger, Accordion, AccordionGroup, Badge, Callout, ParamField,
  ResponseField, Expandable, Frame, CodeGroup, Table, Th, Td, Check,
  Update, Tooltip, RequestExample, ResponseExample, ApiPlayground, CodeGenerator
} from "./MdxComponents";
import { H1, H2, H3, H4, P, Ul, Ol, A, InlineCode, Pre } from "./MarkdownElements";

export const docComponents = {
  // Docs components
  Note, Tip, Info, Warning, Danger, Check, Callout,
  Steps, Step, Tabs, Tab, AccordionGroup, Accordion, CardGroup, Card,
  Expandable, Frame, Update, Badge, Tooltip,
  CodeGroup, CodeBlock, ParamField, ResponseField, RequestExample, ResponseExample,
  ApiPlayground, CodeGenerator,

  // Styled HTML elements
  h1: H1, h2: H2, h3: H3, h4: H4, p: P, ul: Ul, ol: Ol, a: A,
  code: InlineCode, pre: Pre, table: Table, th: Th, td: Td,
};
