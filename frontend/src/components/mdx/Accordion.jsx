import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { IconResolver } from "./IconResolver";

export function AccordionGroup({ children }) {
  return (
    <div className="flex flex-col gap-2 my-8">
      {children}
    </div>
  );
}

export function Accordion({ title, icon, children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between px-5 py-4 cursor-pointer outline-none transition-colors
          ${isOpen ? "bg-slate-50/50 dark:bg-slate-800/20" : "bg-transparent"}
        `}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <IconResolver name={icon} size={18} className="text-slate-500 dark:text-slate-400" />
          )}
          <strong className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </strong>
        </div>
        
        <div className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`}>
          <ChevronDown size={18} />
        </div>
      </button>
      
      {/* Content */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}