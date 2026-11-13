import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const DashboardLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-full bg-[#17211B] text-[#F7F6F0] overflow-hidden">
      {/* Fixed Admin Sidebar */}
      <Sidebar />

      {/* Main View Area */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        <Header />
        
        {/* Scrollable Workspace Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#121915]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

