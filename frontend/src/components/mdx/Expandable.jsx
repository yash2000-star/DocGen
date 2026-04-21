import React, { useState } from "react";

export function Expandable({ title = "Show properties", children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors bg-transparent border-none p-0 cursor-pointer outline-none"
      >
        <span 
          className="text-[14px] transition-transform duration-200 ease-in-out"
          style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▸
        </span>
        {isOpen ? "Hide properties" : title}
      </button>
      
      {isOpen && (
        <div className="mt-4 pl-5 border-l-2 border-slate-200 dark:border-slate-800 flex flex-col gap-2">
          {children}
        </div>
      )}
    </div>
  );
}