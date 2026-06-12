import { NavLink, Outlet } from 'react-router-dom';
import { UploadCloud, LayoutDashboard, Filter, AlertTriangle, Send } from 'lucide-react';

export default function MainLayout() {
  const navItems = [
    { path: '/import', label: 'Veri Yükle', icon: <UploadCloud size={20} /> },
    { path: '/dashboard', label: 'Dashboard & Raporlar', icon: <LayoutDashboard size={20} /> },
    { path: '/filter', label: 'Verileri Filtrele', icon: <Filter size={20} /> },
    { path: '/validation', label: 'Veri Validasyonu', icon: <AlertTriangle size={20} /> },
    { path: '/sync', label: 'API Senkronizasyonu', icon: <Send size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sol Menü (Sidebar) */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="h-16 flex items-center px-6 font-bold text-xl border-b border-slate-800">
          <span className="text-blue-500 mr-2">MAGNA</span> Takip
        </div>
        <nav className="flex-1 py-6">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-6 py-3 text-sm transition-colors ${
                      isActive ? 'bg-blue-600 text-white border-r-4 border-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      {/* Ana İçerik Alanı (Outlet sayfaları buraya render eder) */}
      <main className="flex-1 overflow-y-auto p-10"><Outlet /></main>
    </div>
  );
}