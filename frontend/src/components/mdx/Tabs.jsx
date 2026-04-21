import React, { useState } from "react";

export function Tabs({ children }) {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = React.Children.toArray(children);

  return (
    <div className="my-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Tab Headers */}
      <div className="flex bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 overflow-x-auto hide-scrollbar">
        {tabs.map((tab, index) => {
          const isActive = activeTab === index;
          return (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`
                flex-1 sm:flex-none px-6 py-3 cursor-pointer border-0 border-b-2 border-solid text-[14px] transition-all duration-200 whitespace-nowrap outline-none
                ${isActive 
                  ? "bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-slate-100 border-b-sky-500" 
                  : "bg-transparent font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 border-b-transparent hover:border-b-slate-300 dark:hover:border-b-slate-700"
                }
              `}
            >
              {tab.props.title}
            </button>
          );
        })}
      </div>
      
      {/* Active Content */}
      <div className="p-6 bg-white dark:bg-slate-900">
        {tabs[activeTab]}
      </div>
    </div>
  );
}

export function Tab({ children }) {
  return <div>{children}</div>;
}