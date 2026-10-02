import React from 'react';
import { NavLink } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { FLOWS } from '../lib/flows';

const navClass = ({ isActive }) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
  }`;

const Layout = ({ children }) => {
  const { config, isConfigured } = useConfig();
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-2xl">🔐</span>
            <span className="font-bold text-gray-900">Network Token Tester</span>
          </div>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/settings" className={navClass}>⚙️ Settings</NavLink>
            <NavLink to="/home" end className={navClass}>Flows</NavLink>
            {FLOWS.map(f => (
              <NavLink key={f.id} to={`/flow/${f.id}`} className={navClass}>
                Flow {f.number}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto text-xs">
            {isConfigured ? (
              <span className="px-2 py-1 rounded-full bg-success-50 text-success-700 border border-success-100 font-mono">
                ● {config.merchantId}
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full bg-warning-50 text-warning-700 border border-warning-100">
                ● Not configured
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
};

export default Layout;
