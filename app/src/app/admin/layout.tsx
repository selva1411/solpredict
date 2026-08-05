'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, TrendingUp, Users, Shield, Settings, DollarSign,
  Activity, Menu, X, Zap, ChevronRight,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Overview', icon: BarChart3, exact: true },
  { href: '/admin/markets', label: 'Markets', icon: TrendingUp },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/proposals', label: 'Proposals', icon: Shield },
  { href: '/admin/treasury', label: 'Treasury', icon: DollarSign },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

function NavItem({ item, pathname }: { item: typeof navItems[0]; pathname: string }) {
  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link href={item.href}>
      <motion.div
        whileHover={{ x: 3 }}
        className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer group ${
          isActive
            ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/10 text-white border border-cyan-500/30'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
      >
        {isActive && (
          <motion.div
            layoutId="nav-indicator"
            className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-400 to-purple-500 rounded-full"
          />
        )}
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
        <span className="text-sm font-medium">{item.label}</span>
        {isActive && <ChevronRight className="w-3 h-3 ml-auto text-cyan-400/60" />}
      </motion.div>
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // The main /admin page renders its own full tabbed layout, so it bypasses the sidebar.
  const isMainAdmin = pathname === '/admin';

  if (isMainAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white flex">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : '-100%' }}
        className="fixed inset-y-0 left-0 z-30 w-64 lg:static lg:translate-x-0 flex flex-col bg-[#0A0B12] border-r border-white/[0.06]"
        style={{ transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent leading-none">
              PREDICT-X
            </h1>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-0.5">Admin Panel</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden p-1 rounded-lg hover:bg-white/5 text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status indicator */}
        <div className="mx-4 mt-4 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400 font-medium">System Operational</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/[0.06]">
          <Link href="/" className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors px-2 py-2 rounded-lg hover:bg-white/5">
            <Activity className="w-3 h-3" />
            Back to App
          </Link>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 border-b border-white/[0.06] bg-[#0A0B12]/80 backdrop-blur-xl sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-white">Admin Panel</span>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
