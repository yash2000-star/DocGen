import React from "react";
import CodeBlock from "./CodeBlock";
import { Tabs, Tab } from "./Tabs";
import { Card, CardGroup } from "./Card"
import { Accordion, AccordionGroup } from "./Accordion";
import { Expandable } from "./Expandable";
import { CodeGroup } from "./CodeGroup";
import { ApiPlayground } from "./ApiPlayground";
import { CodeGenerator } from "./CodeGenerator";
import { Info as InfoIcon, AlertTriangle, Lightbulb, AlertCircle, FileText } from "lucide-react";

export const Note = ({ children }) => {
    return (
        <div className="bg-blue-50/50 dark:bg-blue-900/20 border-l-[3px] border-blue-500 rounded-r-xl p-5 my-6 shadow-sm">
            <strong className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-[15px] font-semibold mb-2">
                <InfoIcon size={18} /> Note
            </strong>
            <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-[15px]">
                {children}
            </div>
        </div>
    );
};

export const Warning = ({ children }) => {
  return (
    <div className="bg-amber-50/50 dark:bg-amber-900/20 border-l-[3px] border-amber-500 rounded-r-xl p-5 my-6 shadow-sm">
      <strong className="flex items-center gap-2 text-amber-700 dark:text-amber-500 text-[15px] font-semibold mb-2">
        <AlertTriangle size={18} /> Warning
      </strong>
      <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-[15px]">
        {children}
      </div>
    </div>
  );
};

export const Tip = ({ children }) => {
  return (
    <div className="bg-emerald-50/50 dark:bg-emerald-900/20 border-l-[3px] border-emerald-500 rounded-r-xl p-5 my-6 shadow-sm">
      <strong className="flex items-center gap-2 text-emerald-700 dark:text-emerald-500 text-[15px] font-semibold mb-2">
        <Lightbulb size={18} /> Tip
      </strong>
      <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-[15px]">
        {children}
      </div>
    </div>
  );
};

export const Info = ({ children }) => {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 border-l-[3px] border-slate-500 dark:border-slate-400 rounded-r-xl p-5 my-6 shadow-sm">
      <strong className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-[15px] font-semibold mb-2">
        <FileText size={18} /> Info
      </strong>
      <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-[15px]">
        {children}
      </div>
    </div>
  );
};

export const Danger = ({ children }) => {
  return (
    <div className="bg-red-50/50 dark:bg-red-900/20 border-l-[3px] border-red-500 rounded-r-xl p-5 my-6 shadow-sm">
      <strong className="flex items-center gap-2 text-red-700 dark:text-red-400 text-[15px] font-semibold mb-2">
        <AlertCircle size={18} /> Danger
      </strong>
      <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-[15px]">
        {children}
      </div>
    </div>
  );
};

export const Badge = ({ children, type = "default" }) => {
  const styles = {
    default: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", 
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400", 
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400", 
    danger:  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400", 
    info:    "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400", 
  };

  const styleClass = styles[type] || styles.default;

  return (
    <span className={`${styleClass} px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide inline-flex items-center align-middle ml-2 -translate-y-[1px]`}>
      {children}
    </span>
  );
};

export const Callout = ({ title, icon = "💡", color = "#3b82f6", children }) => {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 border-l-4 border-l-blue-500 rounded-lg p-4 my-6 shadow-sm">
      {title && (
        <strong className="flex items-center gap-2 text-base text-slate-900 dark:text-slate-100 mb-2">
          <span>{icon}</span> {title}
        </strong>
      )}
      <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
        {children}
      </div>
    </div>
  );
};

export const Steps = ({ children }) => {
  // We use React.Children.map to pass down the index so we can number the steps
  return (
    <div className="my-8 step-container">
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { index: index + 1 });
        }
        return child;
      })}
    </div>
  );
};

export const Step = ({ title, index, children }) => {
  return (
    <div className="relative pl-10 pb-10 border-l-2 border-slate-200 dark:border-slate-700 last:border-transparent last:pb-0">
      {/* The Numbered Timeline Circle */}
      <div className="absolute -left-[17px] top-0 flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-sm">
        <span className="text-[13px] font-bold text-slate-600 dark:text-slate-400">{index}</span>
      </div>
      
      {/* Step Content */}
      <h3 className="m-0 mb-2 text-[17px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-tight pt-1">
        {title}
      </h3>
      <div className="text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed">
        {children}
      </div>
    </div>
  );
};

export const ParamField = ({ body, query, path, name, type, required, children }) => {
  let paramSource = "";
  if (body) paramSource = "body";
  if (query) paramSource = "query";
  if (path) paramSource = "path";

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 py-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <code className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
          {name}
        </code>
        
        <span className="text-[13px] text-slate-500 dark:text-slate-400 font-mono">
          {type}
        </span>
        
        {required && (
          <span className="text-[10px] text-orange-600 dark:text-orange-500 font-bold uppercase tracking-wider">
            Required
          </span>
        )}

        {paramSource && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">
            {paramSource}
          </span>
        )}
      </div>
      
      <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mt-1">
        {children}
      </div>
    </div>
  );
};

export const ResponseField = ({ name, type, required, children }) => {
  return (
    <ParamField name={name} type={type} required={required}>
      {children}
    </ParamField>
  );
};

export const Frame = ({ caption, children }) => {
  return (
    <div className="my-8">
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900/50 p-3 shadow-sm">
        {children}
      </div>
      {caption && (
        <div className="text-center text-slate-500 dark:text-slate-400 text-[13px] mt-3 italic">
          {caption}
        </div>
      )}
    </div>
  );
};

export const Table = ({ children }) => (
  <div className="overflow-x-auto my-8 rounded-lg border border-slate-200 dark:border-slate-700">
    <table className="w-full border-collapse text-sm text-left">
      {children}
    </table>
  </div>
);

export const Th = ({ children }) => (
  <th className="border-b-2 border-slate-200 dark:border-slate-700 p-3 text-slate-900 dark:text-slate-100 font-semibold bg-slate-50 dark:bg-slate-800/50">
    {children}
  </th>
);

export const Td = ({ children }) => (
  <td className="border-b border-slate-200 dark:border-slate-700 p-3 text-slate-700 dark:text-slate-300">
    {children}
  </td>
);

export const Check = ({ children }) => (
  <div className="flex items-start gap-2.5 my-3 text-slate-700 dark:text-slate-300">
    <span className="text-emerald-500 text-lg font-bold leading-tight">✓</span>
    <span className="leading-relaxed text-sm">{children}</span>
  </div>
);

export const Update = ({ label = "Update", date, children }) => (
  <div className="my-8 border-l-2 border-slate-200 dark:border-slate-700 pl-6 relative">
    <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
    
    <div className="flex gap-3 items-center mb-3">
      <Badge type="info">{label}</Badge>
      {date && <span className="text-slate-500 dark:text-slate-400 text-sm font-semibold">{date}</span>}
    </div>
    
    <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
      {children}
    </div>
  </div>
);

export const Tooltip = ({ text, children }) => (
  <span 
    title={text}
    className="border-b border-dashed border-slate-400 dark:border-slate-500 cursor-help text-slate-900 dark:text-slate-100 font-medium"
  >
    {children}
  </span>
);

export const RequestExample = ({ children }) => {
  return (
    <div className="api-example-block my-8">
      <div className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-1.5">
        <span className="text-blue-500">↗</span> Request Example
      </div>
      {children}
    </div>
  );
};

export const ResponseExample = ({ children }) => {
  return (
    <div className="api-example-block my-8">
      <div className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-1.5">
        <span className="text-emerald-500">↘</span> Response Example
      </div>
      {children}
    </div>
  );
};

export { CodeBlock, Tabs, Tab, Card, CardGroup, Accordion, AccordionGroup, Expandable, CodeGroup, ApiPlayground, CodeGenerator };