import React, { useState } from "react";

export function CodeGroup({ children }) {
  const [activeTab, setActiveTab] = useState(0);
  
  // Convert children to an array to map over them
  const tabs = React.Children.toArray(children);

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-slate-800 bg-[#0d1117] shadow-lg flex flex-col group/codegroup relative">
      {/* --- INJECTED CSS FIX ---
          Since CodeBlock already renders a rounded border and header, we strip the 
          CodeBlock's outer wrapper and header exclusively when it's nested inside CodeGroup.
      */}
      <style>{`
        .code-group-content > div { margin: 0 !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; background: transparent !important; }
        .code-group-content > div > div:first-child { display: none !important; } 
      `}</style>

      {/* Dark Mode MacOS-style Tab Headers */}
      <div className="flex bg-slate-800/60 border-b border-slate-700/60 overflow-x-auto hide-scrollbar">
        {tabs.map((tab, index) => {
          // Grab the title or language from the nested <CodeBlock>
          const title = tab.props?.title || tab.props?.language || `Tab ${index + 1}`;
          const isActive = activeTab === index;
          
          return (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`
                px-4 py-2.5 cursor-pointer border-none border-t-2 text-[12px] font-mono tracking-wide whitespace-nowrap transition-all duration-200
                ${isActive 
                  ? "bg-[#0d1117] text-slate-100 border-t-sky-400" 
                  : "bg-transparent text-slate-400 border-t-transparent hover:bg-slate-700/30 hover:text-slate-300"
                }
              `}
            >
              {title}
            </button>
          );
        })}
      </div>
      
      {/* The Active CodeBlock (stripped of its own border via the CSS above) */}
      <div className="code-group-content">
        {tabs[activeTab]}
      </div>
    </div>
  );
}