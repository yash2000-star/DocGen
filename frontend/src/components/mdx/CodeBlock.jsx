import React, { useState } from "react";
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from "lucide-react";

// Dynamically importing languages is an option, but for Mintlify parity we just use the async loader or pre-load common ones
// Here we load common ones to keep bundle small if using async, or we just rely on the fallback gracefully.
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';

SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('javascript', jsx);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('markdown', markdown);

const parseHighlightLines = (linesStr) => {
  if (!linesStr) return [];
  return linesStr.split(',').reduce((acc, part) => {
    const [start, end] = part.split('-').map(Number);
    if (isNaN(start)) return acc;
    if (!end) return [...acc, start];
    
    const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return [...acc, ...range];
  }, []);
};

export default function CodeBlock({ children, language = "javascript", title, highlight = "" }) {
  const [copied, setCopied] = useState(false);

  const rawCode = (typeof children === 'string' ? children : children?.props?.children || "").replace(/\n+$/, "");
  const highlightedLineNumbers = parseHighlightLines(highlight);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-slate-800 bg-[#0d1117] shadow-lg flex flex-col group/codeblock relative">
      {/* Dynamic Header */}
      <div className="flex justify-between items-center px-4 py-2 bg-slate-800/60 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          {title && (
            <span className="text-slate-200 text-[13px] font-medium tracking-wide">
              {title}
            </span>
          )}
          <span className={`text-slate-400 text-[11px] font-mono tracking-wider uppercase ${title ? "border-l border-slate-700 pl-3" : ""}`}>
            {language}
          </span>
        </div>
        
        {/* Copy Button */}
        <button 
          onClick={handleCopy} 
          className="p-1.5 rounded-md hover:bg-slate-700/50 transition-all text-slate-400 hover:text-slate-200 active:scale-95 flex items-center justify-center cursor-pointer"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>
      
      {/* Syntax Highlighting Container */}
      <div className="relative overflow-x-auto text-[13px] sm:text-[14px]">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers={false}
          wrapLines={true}
          customStyle={{
            margin: 0,
            padding: '1.25rem 0', // Top and bottom padding
            backgroundColor: 'transparent',
            minWidth: '100%'
          }}
          lineNumberStyle={{
            minWidth: '3.5em',
            paddingRight: '2.5em',
            textAlign: 'right',
            color: '#475569',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
          lineProps={(lineNumber) => {
            let style = { display: 'block', paddingLeft: '0.5rem', paddingRight: '1rem' };
            if (highlightedLineNumbers.includes(lineNumber)) {
              style.backgroundColor = 'rgba(56, 189, 248, 0.1)'; // Sky-500 tint
              style.borderLeft = '2px solid #38bdf8';
              style.paddingLeft = 'calc(0.5rem - 2px)'; // Adjust for border
            } else {
              style.borderLeft = '2px solid transparent';
            }
            return { style };
          }}
        >
          {rawCode}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}