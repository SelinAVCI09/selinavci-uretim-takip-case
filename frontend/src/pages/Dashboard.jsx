import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Package, Trash2, Clock, AlertTriangle, Calendar, Filter, Zap, CheckCircle, Printer, Maximize2, X, Search, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', workstation: '' });
  const [availableWorkstations, setAvailableWorkstations] = useState([]);
  const [trendView, setTrendView] = useState('daily');
  const [trendOffset, setTrendOffset] = useState(0);
  const [expandedChart, setExpandedChart] = useState(null);
  const [anomalyFilter, setAnomalyFilter] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  useEffect(() => {
    setTrendOffset(0);
  }, [trendView, data]);

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
  if (!data || data.global_total_records === 0) return (
    <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      Henüz veri yüklenmemiş. Raporları görmek için lütfen önce "Veri Yükle" sayfasından CSV dosyanızı içeri aktarın.
    </div>
  );

  // Trend Grafiği Hesaplamaları (Günlük / Haftalık Gruplama & Sayfalama)
  let processedTrend = data?.trend || [];
  if (trendView === 'weekly') {
    const weeklyGroups = {};
    processedTrend.forEach(item => {
      const d = new Date(item.date);
      const day = d.getDay() || 7; // Pazartesi = 1, Pazar = 7
      d.setDate(d.getDate() - day + 1); // İlgili haftanın Pazartesi gününü bul
      const weekStr = d.toISOString().split('T')[0];
      if (!weeklyGroups[weekStr]) weeklyGroups[weekStr] = { sum: 0, count: 0 };
      weeklyGroups[weekStr].sum += item.avg_oee;
      weeklyGroups[weekStr].count += 1;
    });
    processedTrend = Object.keys(weeklyGroups).sort().map(k => ({
      date: k,
      avg_oee: Number((weeklyGroups[k].sum / weeklyGroups[k].count).toFixed(2))
    }));
  }

  const pageSize = trendView === 'daily' ? 14 : 12; // Günlük 14 gün, Haftalık 12 hafta gösterelim
  const maxOffset = Math.max(0, Math.ceil(processedTrend.length / pageSize) - 1);
  const startIndex = Math.max(0, processedTrend.length - (trendOffset + 1) * pageSize);
  const endIndex = processedTrend.length - trendOffset * pageSize;
  const displayTrend = processedTrend.slice(startIndex, endIndex);

  const handlePrevTrend = () => {
    if (trendOffset < maxOffset) setTrendOffset(prev => prev + 1);
  };
  const handleNextTrend = () => {
    if (trendOffset > 0) setTrendOffset(prev => prev - 1);
  };

  // Ekranda kayma (shift) olmadan kusursuz PDF render eden fonksiyon
  const handleDownloadPDF = async () => {
    const element = document.getElementById('dashboard-content');
    if (!element) return;

    setIsExporting(true);
    const originalWidth = element.style.width;
    
    try {
      // Recharts ve CSS grid'in pdf'te kaymasını engellemek için genişliği masaüstü boyutuna sabitliyoruz
      element.style.width = '1200px';
      // Grafiklerin yeniden boyutlanma (resize) animasyonunu tamamlaması için kısa bir süre bekle
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' 
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // İlk sayfayı ekle
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      // Eğer grafikler aşağı taşıyorsa çoklu sayfa olarak ekle
      while (heightLeft > 0) {
        position = position - pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Uretim_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("PDF oluşturma hatası:", err);
      alert("PDF oluşturulurken bir hata meydana geldi.");
    } finally {
      element.style.width = originalWidth;
      setIsExporting(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg">
          <p className="font-bold text-slate-800 dark:text-white mb-1">{label}</p>
          {payload
            .filter(entry => entry.dataKey !== 'start') // Şelale altındaki şeffaf kısmı gizle
            .map((entry, index) => (
              <p key={index} style={{ color: entry.fill || entry.color }} className="text-sm">
                {entry.name}: {typeof entry.value === 'number' && entry.value % 1 !== 0 ? entry.value.toFixed(2) : entry.value}
              </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Grafik İçerikleri ve Açıklamaları (Modal için)
  const chartContent = {
    trend: {
      title: `OEE Trendi (${trendView === 'daily' ? 'Günlük' : 'Haftalık'})`,
      desc: "Seçilen tarih aralığındaki OEE (Genel Ekipman Verimliliği) değerlerinin zaman içindeki eğilimini (artış/azalış) gösterir. Performansın sürekli takibi ve sapmaların erken teşhisi için kullanılır.",
      render: () => (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayTrend}>
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
      )
    },
    waterfall: {
      title: "OEE Kayıp Analizi (Şelale)",
      desc: "%100 mükemmel üretim teorisinden başlayarak Kullanılabilirlik (A), Performans (P) ve Kalite (Q) kayıplarının OEE oranını nasıl düşürdüğünü kademeli olarak gösterir. Kayıpların kaynağını tespit etmeye yarar.",
      render: () => (
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
      )
    },
    shift: {
      title: "Vardiya Bazlı A, P, Q Karşılaştırması",
      desc: "Farklı vardiyaların Kullanılabilirlik (A), Performans (P) ve Kalite (Q) metriklerini karşılaştırır. Hangi vardiyanın hangi alanda eğitime veya iyileştirmeye ihtiyacı olduğunu belirler.",
      render: () => (
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
      )
    },
    downtime: {
      title: "Duruş Nedenleri",
      desc: "Makinelerin çalışmadığı sürelerin (duruşların) nedenlerine göre dağılımını gösterir. En çok zaman kaybettiren duruş sebeplerini (darboğazları) tespit ederek önleyici bakım kararları alınmasını sağlar.",
      render: () => (
        data.kpis.total_downtime > 0 ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.downtime} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {data.downtime.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center -mt-4 pointer-events-none">
              <span className="block text-xl font-bold dark:text-white text-slate-800">{data.kpis.total_downtime}</span>
              <span className="block text-xs text-slate-500">dk</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <CheckCircle size={40} className="text-green-500/50 mb-3" />
            <p>Bu aralıkta duruş verisi bulunmamaktadır.</p>
          </div>
        )
      )
    },
    workstation: {
      title: "İş İstasyonu OEE Sıralaması",
      desc: "Tesis içerisindeki iş istasyonlarının OEE performanslarını sıralar. Hangi hattın verimli çalıştığını, hangisinin genel kapasiteyi düşürdüğünü gösterir.",
      render: () => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.workstation_oee} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
            <XAxis type="number" domain={[0, 100]} stroke="#64748b" />
            <YAxis dataKey="workstation" type="category" tick={{fontSize: 11}} stroke="#64748b" width={80} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="avg_oee" name="OEE (%)" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      )
    },
    scrap: {
      title: "İstasyon Bazlı Fire Dağılımı",
      desc: "Hangi iş istasyonunun ne kadar hatalı (fire) ürün çıkardığını gösterir. Kalite problemlerinin ve malzeme israfının kaynağını bulmak için analiz edilir.",
      render: () => (
        data.scrap_distribution && data.scrap_distribution.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.scrap_distribution} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
              <XAxis type="number" stroke="#64748b" />
              <YAxis dataKey="name" type="category" tick={{fontSize: 11}} stroke="#64748b" width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Fire Adedi" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#64748b', fontSize: 12, fontWeight: 'bold' }}>
                {data.scrap_distribution?.map((entry, index) => <Cell key={`cell-${index}`} fill={['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#ec4899'][index % 6]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <CheckCircle size={40} className="text-green-500/50 mb-3" />
            <p>Bu aralıkta fire (scrap) verisi bulunmamaktadır.</p>
          </div>
        )
      )
    },
    anomalies: {
      title: "Anomali & Doğrulama Hataları Detayı",
      desc: "Sistemde tespit edilen tüm kalite kuralı ihlallerini, eksik ve şüpheli kayıtları listeler. Tablodaki hataları metin bazlı arayarak filtreleyebilirsiniz.",
      render: () => {
        const filteredAnomalies = (data.anomalies || []).filter(a => {
          const text = typeof a.error === 'object' ? JSON.stringify(a.error) : String(a.error);
          return text.toLowerCase().includes(anomalyFilter.toLowerCase());
        });
        return (
          <div className="flex flex-col h-full">
            <div className="mb-4 relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Hata mesajlarında ara..."
                value={anomalyFilter}
                onChange={(e) => setAnomalyFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              {filteredAnomalies.length > 0 ? (
                <ul className="space-y-3">
                  {filteredAnomalies.map((a, i) => (
                    <li key={i} className="flex justify-between items-start text-sm border-b border-red-100 dark:border-red-900/30 pb-3">
                      <div className="pr-4 flex flex-col items-start gap-1.5">
                        {a.count >= 10 ? 
                          <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Sistemik Sorun</span> : 
                          <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Tekil Hata</span>
                        }
                        <span className="text-slate-700 dark:text-slate-300">{typeof a.error === 'object' ? JSON.stringify(a.error) : String(a.error)}</span>
                      </div>
                      <span className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 py-1 px-3 rounded-full font-bold text-xs whitespace-nowrap">{a.count} Adet</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 pb-10">Aranan kriterde hata bulunamadı.</div>
              )}
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div id="dashboard-content" className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* BAŞLIK & FİLTRELER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm print:hidden">
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
          <div className="flex items-center gap-2 ml-2" data-html2canvas-ignore="true">
            <button onClick={() => window.print()} className="flex items-center bg-slate-600 hover:bg-slate-700 text-white rounded-lg px-4 py-2 transition-colors shadow-sm hidden md:flex" title="Tarayıcı Yazdırma Menüsü">
              <Printer size={16} className="mr-2" />
              <span className="text-sm font-medium">Yazdır</span>
            </button>
            <button onClick={handleDownloadPDF} disabled={isExporting} className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 transition-colors shadow-sm disabled:opacity-50" title="Dashboard'u PDF olarak indirin">
              <Download size={16} className={`mr-2 ${isExporting ? 'animate-bounce' : ''}`} />
              <span className="text-sm font-medium">{isExporting ? 'Hazırlanıyor...' : 'PDF İndir'}</span>
            </button>
          </div>
        </div>
      </div>

      {data.total_records === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 mt-6">
          <Filter size={48} className="mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">İlgili tarihte/filtrede bilgi bulunmamaktadır</h3>
          <p>Seçtiğiniz kriterlere uygun veri yok. Lütfen tarih aralığını veya filtreleri değiştirerek tekrar deneyin.</p>
        </div>
      ) : (
        <>
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
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors group" onClick={() => setExpandedChart('trend')} title="Büyüt ve Açıklamasını Gör">
              OEE Trendi ({trendView === 'daily' ? 'Günlük' : 'Haftalık'}) <Maximize2 size={16} className="text-slate-400 group-hover:text-blue-500" />
            </h3>
            <div className="flex items-center gap-3 print:hidden">
              <select 
                value={trendView} 
                onChange={e => setTrendView(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-md p-1.5 outline-none"
              >
                <option value="daily">Günlük</option>
                <option value="weekly">Haftalık</option>
              </select>
              <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                <button onClick={handlePrevTrend} disabled={trendOffset >= maxOffset} className="px-2.5 py-1 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors">
                  &lt;
                </button>
                <button onClick={handleNextTrend} disabled={trendOffset === 0} className="px-2.5 py-1 text-slate-600 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors">
                  &gt;
                </button>
              </div>
            </div>
          </div>
          <div className="h-72">
            {chartContent.trend.render()}
          </div>
        </div>

        {/* OEE Kayıp Şelale (Waterfall) Grafiği */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors group" onClick={() => setExpandedChart('waterfall')} title="Büyüt ve Açıklamasını Gör">
            OEE Kayıp Analizi (Şelale) <Maximize2 size={16} className="text-slate-400 group-hover:text-blue-500" />
          </h3>
          <div className="h-72">
            {chartContent.waterfall.render()}
          </div>
        </div>
      </div>

      {/* GRAFİKLER BÖLÜMÜ 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vardiya Bazlı Performans */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm lg:col-span-2">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors group" onClick={() => setExpandedChart('shift')} title="Büyüt ve Açıklamasını Gör">
            Vardiya Bazlı A, P, Q Karşılaştırması <Maximize2 size={16} className="text-slate-400 group-hover:text-blue-500" />
          </h3>
          <div className="h-72">
            {chartContent.shift.render()}
          </div>
        </div>

        {/* Duruş Nedenleri Pareto (Pie) */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors group" onClick={() => setExpandedChart('downtime')} title="Büyüt ve Açıklamasını Gör">
            Duruş Nedenleri <Maximize2 size={16} className="text-slate-400 group-hover:text-blue-500" />
          </h3>
          <div className="h-72 relative">
            {chartContent.downtime.render()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* İş İstasyonu OEE Sıralaması */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors group" onClick={() => setExpandedChart('workstation')} title="Büyüt ve Açıklamasını Gör">
            İş İstasyonu OEE Sıralaması <Maximize2 size={16} className="text-slate-400 group-hover:text-blue-500" />
          </h3>
          <div className="h-72">
            {chartContent.workstation.render()}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Genel Ortalama OEE</span>
            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">%{data.kpis.avg_oee}</span>
          </div>
        </div>

        {/* İstasyon Bazlı Fire Dağılımı (Bar Chart) */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors group" onClick={() => setExpandedChart('scrap')} title="Büyüt ve Açıklamasını Gör">
            İstasyon Bazlı Fire Dağılımı <Maximize2 size={16} className="text-slate-400 group-hover:text-blue-500" />
          </h3>
          <div className="h-72 relative">
            {chartContent.scrap.render()}
          </div>
          
          {data.scrap_distribution && data.scrap_distribution.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Toplam Fire Adedi</span>
              <span className="text-lg font-bold text-red-600 dark:text-red-400">{data.kpis.total_scrap} Adet</span>
            </div>
          )}
        </div>

        {/* Veri Doğrulama ve Anomali Uyarı Tablosu */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-red-200 dark:border-red-900/50 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center text-red-600 dark:text-red-400 cursor-pointer hover:text-red-500 transition-colors group" onClick={() => { setAnomalyFilter(''); setExpandedChart('anomalies'); }} title="Büyüt ve Filtrele">
            <AlertTriangle className="mr-2" size={20} /> Anomali & Doğrulama Hataları
            <Maximize2 size={16} className="ml-auto text-slate-400 group-hover:text-red-500" />
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Sistemde şüpheli değerler veya hatalar tespit edildi.</p>
          
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4 flex flex-col gap-2">
            <div className="flex justify-between items-center border-b border-red-100 dark:border-red-800/30 pb-2">
              <span className="text-red-800 dark:text-red-300 font-semibold">Kesin Hatalı Kayıt</span>
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">{data.error_count}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-orange-800 dark:text-orange-300 font-semibold">Uyarı / Şüpheli Kayıt</span>
              <span className="text-xl font-bold text-orange-500 dark:text-orange-400">{data.warning_count}</span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {data.anomalies.length > 0 ? (
              <>
                <ul className="space-y-3">
                  {data.anomalies.slice(0, 4).map((a, i) => (
                    <li key={i} className="flex justify-between items-start text-sm border-b border-red-100 dark:border-red-900/30 pb-2">
                      <div className="pr-4 flex flex-col items-start gap-1">
                        {a.count >= 10 ? 
                          <span className="text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider">Sistemik Sorun</span> : 
                          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Tekil Hata</span>
                        }
                        <span className="text-slate-700 dark:text-slate-300 line-clamp-2">{typeof a.error === 'object' ? JSON.stringify(a.error) : String(a.error)}</span>
                      </div>
                      <span className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 py-0.5 px-2 rounded-full font-bold text-xs whitespace-nowrap mt-1">{a.count} Adet</span>
                    </li>
                  ))}
                </ul>
                {data.anomalies.length > 4 && (
                  <div className="mt-3 text-center">
                    <button onClick={() => { setAnomalyFilter(''); setExpandedChart('anomalies'); }} className="text-xs font-bold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                      + {data.anomalies.length - 4} Hatayı Daha Gör
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">Hata bulunamadı.</div>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {/* GRAFİK BÜYÜTME (MODAL) EKRANI */}
      {expandedChart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-slate-900/60 print:hidden" onClick={() => setExpandedChart(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                <Maximize2 size={22} className="text-blue-500" /> 
                {chartContent[expandedChart].title}
              </h2>
              <button onClick={() => setExpandedChart(null)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors" title="Kapat">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 p-6 min-h-0 relative">
               {chartContent[expandedChart].render()}
            </div>
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-800/50">
              <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Bu Grafik Ne Anlama Geliyor?</h4>
              <p className="text-blue-700 dark:text-blue-400 leading-relaxed text-sm">{chartContent[expandedChart].desc}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}