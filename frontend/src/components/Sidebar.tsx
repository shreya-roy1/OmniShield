'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert, Database, Globe, Upload, AlertOctagon, Activity, Network } from 'lucide-react';

const Sidebar = () => {
  const pathname = usePathname();

  const links = [
    { name: 'Dashboard', href: '/', icon: <Activity className="w-4 h-4" /> },
    { name: 'Simulator', href: '/simulator', icon: <Globe className="w-4 h-4" /> },
    { name: 'Tickets', href: '/tickets', icon: <Upload className="w-4 h-4" /> },
    { name: 'Blocklist', href: '/blocklist', icon: <AlertOctagon className="w-4 h-4" /> },
    { name: 'Graph Workspace', href: '/network-investigation', icon: <Network className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col h-full sticky top-0 font-mono select-none">
      <div className="p-4 border-b border-border flex items-center space-x-3">
        <div className="w-8 h-8 bg-black border border-border flex items-center justify-center rounded-none shrink-0">
          <ShieldAlert className="w-5 h-5 text-destructive fill-destructive/10" />
        </div>
        <div className="overflow-hidden">
          <h1 className="text-sm font-bold text-white tracking-tight leading-none truncate">
            OMNISHIELD
          </h1>
          <p className="text-[9px] text-neutral-500 mt-1 uppercase tracking-wider truncate">
            SECURE_GATEWAY
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center space-x-3 px-4 py-2.5 text-xs transition-colors rounded-none ${
                isActive
                  ? 'bg-primary/10 text-primary border-r-2 border-primary'
                  : 'text-neutral-400 hover:bg-secondary/50 hover:text-white'
              }`}
            >
              {link.icon}
              <span className="font-semibold uppercase tracking-wide">{link.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-2 text-[10px] text-neutral-500 uppercase tracking-wide">
          <Database className="w-3.5 h-3.5" />
          <span>Status: Online</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
