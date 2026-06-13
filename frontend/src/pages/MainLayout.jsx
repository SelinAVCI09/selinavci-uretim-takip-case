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
    <div className="flex h-screen print:h-auto bg-slate-50 dark:bg-slate-900 transition-colors duration-300 overflow-hidden print:overflow-visible print:block">
      {/* Sol Menü (Sidebar) */}
      <aside className={`print:hidden bg-slate-900 dark:bg-slate-950 text-white flex flex-col shadow-xl z-10 transition-all duration-300 ease-in-out flex-shrink-0 overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center px-5 border-b border-slate-800">
          <div className={`flex items-center flex-shrink-0 font-extrabold text-xl text-blue-500 transition-all duration-300 ${isSidebarOpen ? 'w-auto pl-1' : 'w-10 justify-center pl-0'}`}>
            M
          </div>
          <div className={`flex items-center overflow-hidden whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'w-48 opacity-100' : 'w-0 opacity-0'}`}>
            <span className="text-blue-500 font-extrabold text-xl">AGNA</span>
            <span className="font-semibold text-sm ml-2 text-slate-300 pt-0.5">Üretim Takip</span>
          </div>
        </div>
        <nav className="flex-1 py-6">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center py-3 px-5 border-r-4 transition-colors duration-200 ${
                      isActive ? 'bg-blue-600 text-white border-blue-400' : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-white'
                    }`
                  }
                  title={!isSidebarOpen ? item.label : ""}
                >
                  <div className="flex items-center justify-center w-10 flex-shrink-0">
                    {item.icon}
                  </div>
                  <span className={`overflow-hidden whitespace-nowrap text-sm transition-all duration-300 ${isSidebarOpen ? 'w-40 opacity-100 ml-3' : 'w-0 opacity-0 ml-0'}`}>
                    {item.label}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Tema ve Kapatma Butonları */}
        <div className="border-t border-slate-800 py-4 flex flex-col gap-2">
          <button 
            onClick={toggleDarkMode}
            className="w-full flex items-center py-2 px-5 border-r-4 border-transparent text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-300"
            title={isDarkMode ? "Açık Tema" : "Koyu Tema"}
          >
            <div className="flex items-center justify-center w-10 flex-shrink-0">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </div>
            <span className={`overflow-hidden whitespace-nowrap text-sm text-left transition-all duration-300 ${isSidebarOpen ? 'w-40 opacity-100 ml-3' : 'w-0 opacity-0 ml-0'}`}>
              Tema Değiştir
            </span>
          </button>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center py-2 px-5 border-r-4 border-transparent text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-300"
            title={isSidebarOpen ? "Menüyü Daralt" : "Menüyü Genişlet"}
          >
            <div className="flex items-center justify-center w-10 flex-shrink-0">
              {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </div>
            <span className={`overflow-hidden whitespace-nowrap text-sm text-left transition-all duration-300 ${isSidebarOpen ? 'w-40 opacity-100 ml-3' : 'w-0 opacity-0 ml-0'}`}>
              Menüyü Daralt
            </span>
          </button>
        </div>
      </aside>
      {/* Ana İçerik Alanı (Outlet sayfaları buraya render eder) */}
      <main className="flex-1 overflow-y-auto print:overflow-visible print:block p-10 dark:text-slate-200"><Outlet /></main>
    </div>
  );
}