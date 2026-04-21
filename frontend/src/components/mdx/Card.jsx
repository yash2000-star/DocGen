import React from "react";
import { IconResolver } from "./IconResolver";

export function CardGroup({ children, cols = 2 }) {
  // Use Tailwind Grid based on the requested columns.
  // We use inline styling as a fallback because dynamic Tailwind class generation (grid-cols-[X]) 
  // can sometimes be purged by Vite if it doesn't statically exist in the source text.
  return (
    <div 
      className="grid gap-4 my-8" 
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(250px, 100%), 1fr))`
      }}
    >
      {children}
    </div>
  );
}

export function Card({ title, icon, href, children }) {
  const isLink = !!href;
  const Wrapper = isLink ? "a" : "div";
  
  return (
    <Wrapper 
      href={href || undefined}
      className={`
        block p-6 bg-white dark:bg-slate-900 
        border border-slate-200 dark:border-slate-800 
        rounded-xl shadow-sm 
        transition-all duration-200 ease-in-out
        ${isLink ? 'cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5' : ''}
      `}
      onClick={(e) => {
        if (isLink && href.startsWith('/')) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("doc-change", { detail: href }));
        }
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        {icon && (
          <div className="flex items-center justify-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <IconResolver name={icon} size={20} className="text-slate-700 dark:text-slate-300" />
          </div>
        )}
        <h3 className="m-0 text-[16px] font-semibold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">
          {title}
        </h3>
      </div>
      <div className="m-0 text-[14px] text-slate-600 dark:text-slate-400 leading-relaxed">
        {children}
      </div>
    </Wrapper>
  );
}