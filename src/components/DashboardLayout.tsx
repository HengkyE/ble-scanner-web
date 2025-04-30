'use client';

import React from 'react';
import AppNavbar from './Navbar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({children}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <div className="w-full py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <main className="flex-grow">{children}</main>
        </div>
      </div>
      <footer className="py-6 px-8 text-center text-muted-foreground text-sm border-t border-border mt-8 bg-card">
        <div className="mx-auto max-w-7xl">
          © {new Date().getFullYear()} BLE Scanner Water Level Monitoring
        </div>
      </footer>
    </div>
  );
}
