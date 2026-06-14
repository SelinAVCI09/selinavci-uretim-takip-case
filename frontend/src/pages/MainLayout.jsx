import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { UploadCloud, LayoutDashboard, Filter, AlertTriangle, Send, ChevronLeft, ChevronRight, Sun, Moon, Settings, X, Save } from 'lucide-react';
import axios from 'axios';

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [validationSettings, setValidationSettings] = useState({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const SETTINGS_INFO = {
    missing_wo: { label: "Eksik İş Emri", desc: "İş emri no boş bırakılamaz." },
    format_wo: { label: "İş Emri Formatı", desc: "Standart format (302 ile başlar, 10 hane)." },
    invalid_shift: { label: "Vardiya Kontrolü", desc: "Vardiya 1, 2 veya 3 olmalıdır." },
    missing_ws: { label: "Eksik İş İstasyonu", desc: "İş İstasyonu alanı zorunludur." },
    missing_product: { label: "Eksik Ürün (Stok)", desc: "Stok Adı alanı zorunludur." },
    missing_metrics: { label: "Boş Metrik Verileri", desc: "A, P, Q, Süre ve Üretim verileri boş olamaz." },
    invalid_date: { label: "Tarih Doğrulaması", desc: "Tarih boş veya bugünden ileri olamaz." },
    negative_prod: { label: "Negatif Üretim / Fire", desc: "Üretim en az 1 olmalı, fire negatif olamaz." },
    scrap_gt_prod: { label: "Fire > Toplam Üretim", desc: "Fire miktarı üretimden büyük olamaz." },
    prod_zero_worktime: { label: "Süresiz Üretim", desc: "Çalışma süresi sıfırken üretim yapılamaz." },
    zero_prod_long_run: { label: "Uzun Çalışma & Sıfır Ürün", desc: "Çalışma > 60dk iken üretim 0 ise uyar." },
    downtime_mismatch: { label: "Duruş Süresi Kırılımı", desc: "Toplam Duruş = Planlı + Plansız Duruş." },
    downtime_gt_worktime: { label: "Duruş > Çalışma Süresi", desc: "Duruş, çalışma süresini geçemez." },
    out_of_range_pct: { label: "Yüzdelik Aralık", desc: "A, P, Q ve OEE 0-100 arasında olmalıdır." },
    oee_mismatch: { label: "OEE Çapraz Kontrolü", desc: "A * P * Q ile Raporlanan OEE eşleşmelidir." },
    avail_100_with_downtime: { label: "Kullanılabilirlik (A) Hatası", desc: "Duruş varsa Kullanılabilirlik (A) %100 olamaz." },
    capacity_exceed: { label: "Kapasite Aşımı (P > 100)", desc: "Performans %100'ü aşarsa uyar." }
  };

  const handleOpenSettings = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/v1/validation-settings');
      setValidationSettings(response.data || {});
      setIsSettingsModalOpen(true);
    } catch (error) {
      console.error('Ayarlar çekilemedi', error);
    }
  };

  const handleSettingChange = (key, field, value) => {
    setValidationSettings(prev => {
      const current = prev[key];
      const isObj = typeof current === 'object';
      return {
        ...prev,
        [key]: {
          active: isObj ? current.active : current,
          action: isObj ? current.action : 'uyar',
          [field]: value
        }
      };
    });
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await axios.put('http://localhost:8000/api/v1/validation-settings', validationSettings);
      await axios.post('http://localhost:8000/api/v1/revalidate');
      setIsSettingsModalOpen(false);
      alert('Ayarlar kaydedildi ve tüm veriler yeniden doğrulandı.');
      window.location.reload(); 
    } catch (error) {
      console.error('Ayarlar kaydedilemedi', error);
      alert('Ayarlar kaydedilemedi.');
    } finally {
      setIsSavingSettings(false);
    }
  };

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
            onClick={handleOpenSettings}
            className="w-full flex items-center py-2 px-5 border-r-4 border-transparent text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-300"
            title="Validasyon Ayarları"
          >
            <div className="flex items-center justify-center w-10 flex-shrink-0">
              <Settings size={20} />
            </div>
            <span className={`overflow-hidden whitespace-nowrap text-sm text-left transition-all duration-300 ${isSidebarOpen ? 'w-40 opacity-100 ml-3' : 'w-0 opacity-0 ml-0'}`}>
              Validasyon Ayarları
            </span>
          </button>
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

      {/* Validasyon Ayarları Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center"><Settings className="mr-2" size={20} /> Validasyon Kuralları & Aksiyon Ayarları</h2>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/20">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Sistemin verileri denetlerken kullanacağı kalite kurallarını ve bu kurallara uymayan kayıtlara atanacak aksiyonu (Kesin Hatalı, Uyarı vs.) buradan yönetebilirsiniz.
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.keys(validationSettings || {}).map(key => {
                  const setting = validationSettings[key];
                  const isActive = typeof setting === 'object' ? setting.active : setting;
                  const action = typeof setting === 'object' ? setting.action : 'uyar';
                  return (
                  <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm gap-4">
                    <div className="flex-1 pr-2">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">{SETTINGS_INFO[key]?.label || key}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{SETTINGS_INFO[key]?.desc}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <select 
                        value={action} 
                        onChange={(e) => handleSettingChange(key, 'action', e.target.value)}
                        disabled={!isActive}
                        className="text-xs border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-white rounded-md p-1.5 border outline-none disabled:opacity-50 font-medium"
                      >
                        <option value="reddet">❌ Reddet</option>
                        <option value="düzelt">✏️ Düzelt</option>
                        <option value="uyar">⚠️ Uyar</option>
                      </select>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={isActive} onChange={(e) => handleSettingChange(key, 'active', e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                )})}
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-end gap-3">
              <button onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-sm">İptal</button>
              <button onClick={handleSaveSettings} disabled={isSavingSettings} className="px-4 py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors text-sm flex items-center">
                <Save size={16} className={`mr-2 ${isSavingSettings ? 'animate-pulse' : ''}`} /> {isSavingSettings ? 'Kaydediliyor...' : 'Kaydet ve Uygula'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}