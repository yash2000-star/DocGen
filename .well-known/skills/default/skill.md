---
name: DocGen Documentation Platform
description: AI-readable skill file for the DocGen Documentation Platform documentation platform
generated: 2026-04-21T04:48:26.244Z
---

# DocGen Documentation Platform

This is an auto-generated skill file describing the documentation site powered by **DocGen** — an open-source Mintlify clone built with Node.js.

## About This Site

- **Platform**: DocGen (Mintlify-compatible)
- **Primary Brand Color**: `#3b82f6`
- **Theme**: mint
- **Total Documentation Files**: 26

## Navigation Structure

| # | Group | Items |
|---|-------|-------|
| - | No navigation configured yet | - |


## Documentation Files

| File | Title | Size |
|------|-------|------|
| `yash2000-star/secrets-app/api-reference.mdx` | api-reference | 3.5 KB |
| `yash2000-star/secrets-app/authentication-flow.mdx` | authentication-flow | 4.7 KB |
| `yash2000-star/secrets-app/configuration.mdx` | configuration | 3.2 KB |
| `yash2000-star/secrets-app/data-models.mdx` | data-models | 2.6 KB |
| `yash2000-star/secrets-app/introduction.mdx` | introduction | 2.6 KB |
| `yash2000-star/secrets-app/quickstart.mdx` | quickstart | 2.5 KB |
| `yash2000-star/to-do-list/api-routes.mdx` | api-routes | 3.5 KB |
| `yash2000-star/to-do-list/data-model.mdx` | data-model | 3.0 KB |
| `yash2000-star/to-do-list/introduction.mdx` | introduction | 2.7 KB |
| `yash2000-star/to-do-list/managing-tasks.mdx` | managing-tasks | 3.2 KB |
| `yash2000-star/to-do-list/priority-and-filtering.mdx` | priority-and-filtering | 3.3 KB |
| `yash2000-star/to-do-list/quickstart.mdx` | quickstart | 2.3 KB |
| `yash2000-star/to-do-list/styling-customization.mdx` | styling-customization | 3.9 KB |
| `yash2000-star/secrets-app/api-reference.mdx` | api-reference | 3.5 KB |
| `yash2000-star/secrets-app/authentication-flow.mdx` | authentication-flow | 4.7 KB |
| `yash2000-star/secrets-app/configuration.mdx` | configuration | 3.1 KB |
| `yash2000-star/secrets-app/data-models.mdx` | data-models | 2.6 KB |
| `yash2000-star/secrets-app/introduction.mdx` | introduction | 2.5 KB |
| `yash2000-star/secrets-app/quickstart.mdx` | quickstart | 2.4 KB |
| `yash2000-star/to-do-list/api-routes.mdx` | api-routes | 3.5 KB |
| `yash2000-star/to-do-list/data-model.mdx` | data-model | 3.0 KB |
| `yash2000-star/to-do-list/introduction.mdx` | introduction | 2.6 KB |
| `yash2000-star/to-do-list/managing-tasks.mdx` | managing-tasks | 3.2 KB |
| `yash2000-star/to-do-list/priority-and-filtering.mdx` | priority-and-filtering | 3.3 KB |
| `yash2000-star/to-do-list/quickstart.mdx` | quickstart | 2.2 KB |
| `yash2000-star/to-do-list/styling-customization.mdx` | styling-customization | 3.8 KB |


## Available MDX Components

This documentation platform supports the following custom MDX components that can be used inside `.md` and `.mdx` files:

| Component | Usage | Description |
|-----------|-------|-------------|
| `<Accordion>` | `<Accordion title="FAQ">` | Collapsible content sections |
| `<AccordionGroup>` | `<AccordionGroup>` | Groups multiple accordions |
| `<Card>` | `<Card title="Feature" icon="⚡">` | Feature/info cards |
| `<CardGroup>` | `<CardGroup cols={3}>` | Grid layout for cards |
| `<Tabs>` / `<Tab>` | `<Tabs><Tab title="JS">` | Tabbed content panels |
| `<CodeBlock>` | `<CodeBlock language="js" title="example">` | Syntax-highlighted code with copy button |
| `<CodeGroup>` | `<CodeGroup>` | Tabbed code blocks (multi-language) |
| `<Steps>` / `<Step>` | `<Steps><Step title="Install">` | Numbered step-by-step guides |
| `<Note>` | `<Note>` | Blue info callout |
| `<Warning>` | `<Warning>` | Amber warning callout |
| `<Tip>` | `<Tip>` | Green tip callout |
| `<Info>` | `<Info>` | Gray informational callout |
| `<Danger>` | `<Danger>` | Red danger callout |
| `<Callout>` | `<Callout title="Note" icon="💡">` | Generic callout with custom icon & color |
| `<Badge>` | `<Badge type="success">NEW</Badge>` | Inline label badges |
| `<Frame>` | `<Frame caption="Screenshot">` | Image frame with caption |
| `<Expandable>` | `<Expandable title="Details">` | Expandable content block |
| `<ParamField>` | `<ParamField body name="id" type="string" required>` | API parameter documentation |
| `<ResponseField>` | `<ResponseField name="data" type="object">` | API response field documentation |
| `<ApiPlayground>` | `<ApiPlayground method="GET" endpoint="/users">` | Interactive API testing |
| `<CodeGenerator>` | `<CodeGenerator method="POST" endpoint="/auth">` | Auto-generated code snippets (cURL, JS, Python) |

## Best Practices

1. **File Organization**: Place documentation files in `/docs/{tenant}/{project}/` following the tenant/project structure
2. **Frontmatter**: Use YAML frontmatter for metadata: `title`, `order`, `group`
3. **Navigation**: Define sidebar order in `docs.json` under the `navigation` array
4. **Theming**: Set brand colors in `docs.json` under `colors.primary`
5. **Search**: All content is automatically indexed for full-text search
6. **AI Context**: Use the MCP endpoint (`/api/mcp/:tenant/:project`) to let AI agents read your docs
7. **Code Blocks**: Always specify the language for syntax highlighting: ```javascript

## Key Configuration Options

The `docs.json` file supports these key fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Site/project display name |
| `colors.primary` | string | Primary brand color (hex) |
| `logo.light` / `logo.dark` | string | Logo paths for light/dark mode |
| `navigation` | array | Sidebar navigation structure |
| `tabs` | array | Top-level navigation tabs |
| `topbarCtaButton` | object | Call-to-action button in topbar |
| `footerSocials` | object | Social links in footer |
| `modeToggle` | object | Light/dark mode toggle config |
| `api.baseUrl` | string | Base URL for API playground |
| `api.auth` | object | Authentication method config |
| `analytics` | object | PostHog, GA4, Amplitude keys |
| `search.prompt` | string | Custom search placeholder text |
| `metadata` | object | OpenGraph meta tags |
