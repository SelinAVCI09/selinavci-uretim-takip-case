import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Package, Trash2, Clock } from 'lucide-react';

export default function Dashboard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/v1/records');
        setRecords(res.data);
      } catch (err) {
        console.error('Veriler çekilemedi', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Raporlar yükleniyor...</div>;

  if (records.length === 0) return (
    <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      Henüz veri yüklenmemiş. Raporları görmek için lütfen önce "Veri Yükle" sayfasından CSV dosyanızı içeri aktarın.
    </div>
  );

  // KPI Hesaplamaları
  const validRecords = records.filter(r => r.is_valid);
  const avgOee = validRecords.length > 0 ? (validRecords.reduce((acc, r) => acc + (r.oee || 0), 0) / validRecords.length).toFixed(1) : 0;
  const totalProd = records.reduce((acc, r) => acc + (r.total_produced || 0), 0);
  const totalScrap = records.reduce((acc, r) => acc + (r.scrap_qty || 0), 0);
  const totalDownTime = records.reduce((acc, r) => acc + (r.down_time || 0), 0);

  // Günlere Göre Ortalama OEE (Basit Çubuk Grafik için veri hazırlığı)
  const dateGroups = records.reduce((acc, r) => {
    if (!r.date) return acc;
    if (!acc[r.date]) acc[r.date] = { oeeSum: 0, count: 0 };
    if (r.is_valid && r.oee) {
      acc[r.date].oeeSum += r.oee;
      acc[r.date].count += 1;
    }
    return acc;
  }, {});

  const chartData = Object.entries(dateGroups).map(([date, data]) => ({
    date,
    avgOee: data.count > 0 ? (data.oeeSum / data.count).toFixed(1) : 0
  })).sort((a, b) => a.date.localeCompare(b.date)).slice(-14); // Son 14 günü göster

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Üretim Performans Özeti</h1>
      
      {/* KPI Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center"><div className="p-4 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg mr-4"><Activity size={24}/></div><div><p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Ortalama OEE</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">%{avgOee}</h3></div></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center"><div className="p-4 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg mr-4"><Package size={24}/></div><div><p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Toplam Üretim</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{totalProd.toLocaleString()}</h3></div></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center"><div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg mr-4"><Trash2 size={24}/></div><div><p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Toplam Fire</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{totalScrap.toLocaleString()}</h3></div></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center"><div className="p-4 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg mr-4"><Clock size={24}/></div><div><p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Toplam Duruş</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{totalDownTime.toLocaleString()} dk</h3></div></div>
      </div>

      {/* OEE Trend Grafiği (Tailwind ile Native Çizim) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mt-6">
        <h3 className="font-bold text-slate-800 dark:text-white mb-6">Günlük Ortalama OEE Trendi (Son 14 Gün)</h3>
        <div className="flex items-end space-x-4 h-64 border-b border-slate-100 dark:border-slate-700 pb-2">
          {chartData.map(d => (
            <div key={d.date} className="flex flex-col items-center flex-1 group h-full justify-end">
              <span className="text-xs font-bold text-blue-600 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">%{d.avgOee}</span>
              <div className="w-full max-w-[40px] bg-blue-500 rounded-t-md transition-all duration-500 group-hover:bg-blue-400" style={{ height: `${d.avgOee}%` }}></div>
              <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">{d.date.split('-').slice(1).join('/')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}