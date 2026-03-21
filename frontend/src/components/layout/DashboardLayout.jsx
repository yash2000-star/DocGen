import { Outlet } from "react-router-dom";
import DashboardSidebar from "../dashboard/DashboardSidebar";
import Navbar from "../dashboard/Navbar";

export default function DashboardLayout() {
  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", backgroundColor: "var(--bg-sidebar)" }}>
      
      {/* 1. Sidebar is on the far left, taking full height */}
      <DashboardSidebar /> 
      
      {/* 2. Right column holds the Navbar and the scrolling content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        <Navbar />
        
        {/* The Outlet is where ProjectOverview, ProjectSettings, etc. will render */}
        <main style={{ flex: 1, overflowY: "auto" }}>
           <Outlet />
        </main>
        
      </div>
    </div>
  );
}