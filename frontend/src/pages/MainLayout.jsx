import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { UploadCloud, LayoutDashboard, Filter, AlertTriangle, Send, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Kullanıcının daha önceki tercihini veya bilgisayarının varsayılanını (Gece/Gündüz) anla
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
  };

  const navItems = [
    { path: '/import', label: 'Veri Yükle', icon: <UploadCloud size={20} /> },
    { path: '/dashboard', label: 'Dashboard & Raporlar', icon: <LayoutDashboard size={20} /> },
    { path: '/filter', label: 'Verileri Filtrele', icon: <Filter size={20} /> },
    { path: '/validation', label: 'Veri Validasyonu', icon: <AlertTriangle size={20} /> },
    { path: '/sync', label: 'API Senkronizasyonu', icon: <Send size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 overflow-hidden">
      {/* Sol Menü (Sidebar) */}
      <aside className={`bg-slate-900 dark:bg-slate-950 text-white flex flex-col shadow-xl z-10 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center justify-center px-4 font-bold text-xl border-b border-slate-800">
          <span className="text-blue-500 font-extrabold">{isSidebarOpen ? 'MAGNA' : 'M'}</span>
          {isSidebarOpen && <span className="ml-2">Takip</span>}
        </div>
        <nav className="flex-1 py-6 overflow-hidden">
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
                  title={!isSidebarOpen ? item.label : ""}
                >
                  <span className={isSidebarOpen ? "mr-3" : "mx-auto"}>{item.icon}</span>
                  {isSidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Tema ve Kapatma Butonları */}
        <div className="border-t border-slate-800 p-4 space-y-2">
          <button 
            onClick={toggleDarkMode}
            className={`w-full flex items-center p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors ${isSidebarOpen ? 'justify-start px-4' : 'justify-center'}`}
            title={isDarkMode ? "Açık Tema" : "Koyu Tema"}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            {isSidebarOpen && <span className="ml-3 text-sm whitespace-nowrap">Tema Değiştir</span>}
          </button>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`w-full flex items-center p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors ${isSidebarOpen ? 'justify-start px-4' : 'justify-center'}`}
            title={isSidebarOpen ? "Menüyü Daralt" : "Menüyü Genişlet"}
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            {isSidebarOpen && <span className="ml-3 text-sm whitespace-nowrap">Menüyü Daralt</span>}
          </button>
        </div>
      </aside>
      {/* Ana İçerik Alanı (Outlet sayfaları buraya render eder) */}
      <main className="flex-1 overflow-y-auto p-10 dark:text-slate-200"><Outlet /></main>
    </div>
  );
}