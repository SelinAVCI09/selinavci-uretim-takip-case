import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Package, Trash2, Clock, AlertTriangle, Calendar, Filter, Zap } from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, AreaChart, Area 
} from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', workstation: '' });
  const [availableWorkstations, setAvailableWorkstations] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.workstation) params.append('workstation', filters.workstation);

      const res = await axios.get(`http://localhost:8000/api/v1/dashboard-data?${params.toString()}`);
      setData(res.data);
      if (availableWorkstations.length === 0) {
        setAvailableWorkstations(res.data.workstations.filter(Boolean));
      }
    } catch (err) {
      console.error('Veriler çekilemedi', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) return <div className="p-8 text-center text-slate-500">Raporlar yükleniyor...</div>;
  if (!data || data.total_records === 0) return (
    <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      Henüz veri yüklenmemiş. Raporları görmek için lütfen önce "Veri Yükle" sayfasından CSV dosyanızı içeri aktarın.
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg">
          <p className="font-bold text-slate-800 dark:text-white mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* BAŞLIK & FİLTRELER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Üretim Performans Özeti</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gelişmiş analitik ve OEE verileri</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
            <Calendar size={16} className="text-slate-400 mr-2" />
            <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="bg-transparent border-none text-sm outline-none dark:text-white text-slate-700" />
            <span className="mx-2 text-slate-300">-</span>
            <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="bg-transparent border-none text-sm outline-none dark:text-white text-slate-700" />
          </div>
          
          <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
            <Filter size={16} className="text-slate-400 mr-2" />
            <select value={filters.workstation} onChange={e => setFilters({...filters, workstation: e.target.value})} className="bg-transparent border-none text-sm outline-none dark:text-white text-slate-700 w-32">
              <option value="">Tüm İstasyonlar</option>
              {availableWorkstations.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* CANLI/SON VARDİYA BİLGİSİ */}
      {data.last_shift && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center text-blue-100 text-sm font-medium mb-1">
              <Zap size={16} className="mr-2 text-yellow-300" fill="currentColor" /> Son Vardiya Özeti 
              <span className="mx-2 opacity-50">|</span> {data.last_shift.date}
            </div>
            <h2 className="text-2xl font-bold">Vardiya {data.last_shift.shift} - {data.last_shift.workstation || 'Genel'}</h2>
          </div>
          <div className="flex flex-wrap gap-8 md:text-right">
            <div>
              <p className="text-blue-200 text-sm">OEE</p>
              <p className="text-3xl font-bold">%{data.last_shift.oee?.toFixed(1) || 0}</p>
            </div>
            <div>
              <p className="text-blue-200 text-sm">Gerçekleşen Üretim</p>
              <p className="text-3xl font-bold">{data.last_shift.total_produced?.toLocaleString()}</p>
            </div>
            {data.target_actual && (
              <div className="hidden sm:block">
                <p className="text-blue-200 text-sm">Teorik Beklenen / Hedef</p>
                <p className="text-3xl font-bold text-yellow-300">{data.target_actual.target?.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* KPI Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center"><div className="p-4 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg mr-4"><Activity size={24}/></div><div><p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Ortalama OEE</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">%{data.kpis.avg_oee}</h3></div></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center"><div className="p-4 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg mr-4"><Package size={24}/></div><div><p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Toplam Üretim</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{data.kpis.total_produced?.toLocaleString()}</h3></div></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center"><div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg mr-4"><Trash2 size={24}/></div><div><p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Toplam Fire</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{data.kpis.total_scrap?.toLocaleString()}</h3></div></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center"><div className="p-4 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg mr-4"><Clock size={24}/></div><div><p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Toplam Duruş</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{data.kpis.total_downtime?.toLocaleString()} dk</h3></div></div>
      </div>

      {/* GRAFİKLER BÖLÜMÜ 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OEE Trend Grafiği */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6">OEE Trendi (Günlük)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend}>
                <defs>
                  <linearGradient id="colorOee" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="date" tick={{fontSize: 12}} stroke="#64748b" />
                <YAxis domain={[0, 100]} tick={{fontSize: 12}} stroke="#64748b" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="avg_oee" name="Ortalama OEE" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorOee)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* OEE Kayıp Şelale (Waterfall) Grafiği */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6">OEE Kayıp Analizi (Şelale)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.waterfall} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" tick={{fontSize: 11}} stroke="#64748b" interval={0} />
                <YAxis domain={[0, 100]} tick={{fontSize: 12}} stroke="#64748b" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="start" stackId="a" fill="transparent" />
                <Bar dataKey="val" stackId="a" name="Değer (%)" radius={[4, 4, 4, 4]}>
                  {data.waterfall.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* GRAFİKLER BÖLÜMÜ 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vardiya Bazlı Performans */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm lg:col-span-2">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6">Vardiya Bazlı A, P, Q Karşılaştırması</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.shift_performance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="shift" tick={{fontSize: 12}} stroke="#64748b" />
                <YAxis domain={[0, 100]} tick={{fontSize: 12}} stroke="#64748b" />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" />
                <Bar dataKey="a" name="Kullanılabilirlik" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="p" name="Performans" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="q" name="Kalite" fill="#eab308" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Duruş Nedenleri Pareto (Pie) */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6">Duruş Nedenleri</h3>
          <div className="h-72 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.downtime} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {data.downtime.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center -mt-4">
              <span className="block text-xl font-bold dark:text-white text-slate-800">{data.kpis.total_downtime}</span>
              <span className="block text-xs text-slate-500">dk</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* İş İstasyonu OEE Sıralaması */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6">İş İstasyonu OEE Sıralaması</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.workstation_oee} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                <XAxis type="number" domain={[0, 100]} stroke="#64748b" />
                <YAxis dataKey="workstation" type="category" tick={{fontSize: 11}} stroke="#64748b" width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg_oee" name="OEE (%)" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Veri Doğrulama ve Anomali Uyarı Tablosu */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-red-200 dark:border-red-900/50 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center text-red-600 dark:text-red-400">
            <AlertTriangle className="mr-2" size={20} /> Anomali & Doğrulama Hataları
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Sistemde şüpheli değerler veya hatalar tespit edildi.</p>
          
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4 flex justify-between items-center">
            <span className="text-red-800 dark:text-red-300 font-semibold">Toplam Hatalı Kayıt</span>
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">{data.suspicious_count}</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {data.anomalies.length > 0 ? (
              <ul className="space-y-3">
                {data.anomalies.map((a, i) => (
                  <li key={i} className="flex justify-between items-start text-sm border-b border-red-100 dark:border-red-900/30 pb-2">
                    <span className="text-slate-700 dark:text-slate-300 pr-4">{a.error}</span>
                    <span className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 py-0.5 px-2 rounded-full font-bold text-xs whitespace-nowrap">{a.count} Adet</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">Hata bulunamadı.</div>
            )}
          </div>
        </div>
      </div>

      {/* DETAYLI VARDİYA/İSTASYON VERİ TABLOSU */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-white">Detaylı Üretim Kayıtları (Son 50 Kayıt)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3 font-semibold">Tarih / Vardiya</th>
                <th className="px-6 py-3 font-semibold">İstasyon</th>
                <th className="px-6 py-3 font-semibold text-right">Üretim / Fire</th>
                <th className="px-6 py-3 font-semibold text-right">Süre (Çal / Dur)</th>
                <th className="px-6 py-3 font-semibold text-right">A / P / Q</th>
                <th className="px-6 py-3 font-semibold text-right">OEE</th>
                <th className="px-6 py-3 font-semibold text-center">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {data.table_data.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300">
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="font-medium text-slate-900 dark:text-white">{row.date}</div>
                    <div className="text-xs text-slate-500">Vardiya {row.shift}</div>
                  </td>
                  <td className="px-6 py-3">{row.workstation}</td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-green-600 dark:text-green-400">{row.total_produced}</span> / <span className="text-red-500">{row.scrap_qty}</span>
                  </td>
                  <td className="px-6 py-3 text-right text-slate-500 dark:text-slate-400">
                    {row.work_time} / {row.down_time}
                  </td>
                  <td className="px-6 py-3 text-right text-xs">
                    % {row.a?.toFixed(1)} / % {row.p?.toFixed(1)} / % {row.q?.toFixed(1)}
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                    % {row.oee?.toFixed(1)}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {row.is_valid ? 
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Geçerli"></span> : 
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="Hatalı"></span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="text-center text-sm text-slate-400 mt-4">
        * Yeni analitik görünüm için terminalde <b>npm install recharts</b> komutunun çalıştırılmış olması gerekir.
      </div>
    </div>
  );
}