import { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Filter as FilterIcon, Search, CheckCircle, AlertCircle } from 'lucide-react';

export default function Filter() {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '', endDate: '', shifts: [], workstations: [], stockName: '', minOee: 0, statusFilter: 'all', errorType: ''
  });

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, records]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:8000/api/v1/records');
      setRecords(res.data);
      setFilteredRecords(res.data);
    } catch (err) { 
      console.error('Veriler çekilemedi', err); 
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let data = [...records];
    if (filters.startDate) data = data.filter(r => r.date >= filters.startDate);
    if (filters.endDate) data = data.filter(r => r.date <= filters.endDate);
    if (filters.shifts.length > 0) data = data.filter(r => filters.shifts.includes(r.shift));
    if (filters.workstations.length > 0) data = data.filter(r => filters.workstations.includes(r.workstation_name));
    if (filters.stockName) data = data.filter(r => r.stock_name?.toLowerCase().includes(filters.stockName.toLowerCase()));
    if (filters.minOee > 0) data = data.filter(r => (r.oee || 0) >= filters.minOee);
    if (filters.statusFilter === 'valid') data = data.filter(r => r.is_valid === true);
    if (filters.statusFilter === 'warning') data = data.filter(r => r.record_status === 'warning');
    if (filters.statusFilter === 'error') data = data.filter(r => r.record_status === 'error' || (!r.is_valid && !r.record_status)); // Geriye dönük uyumluluk
    if (filters.statusFilter !== 'all' && filters.errorType) {
      data = data.filter(r => !r.is_valid && parseErrors(r.validation_errors).some(e => e.error_type === filters.errorType));
    }
    setFilteredRecords(data);
  };

  const toggleArrayFilter = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter(v => v !== value) : [...prev[field], value]
    }));
  };

  const parseErrors = (errString) => {
    if (!errString || errString === "null") return [];
    try {
      const parsed = JSON.parse(errString);
      return Array.isArray(parsed) ? parsed : [{ message: errString, error_type: 'Bilinmeyen Hata' }];
    } catch {
      return [{ message: errString, error_type: 'Bilinmeyen Hata' }];
    }
  };

  const uniqueWorkstations = [...new Set(records.map(r => r.workstation_name).filter(Boolean))];
  const uniqueErrorTypes = [...new Set(records.filter(r => !r.is_valid).flatMap(r => parseErrors(r.validation_errors).map(err => err.error_type)).filter(Boolean))];

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = Object.keys(filteredRecords[0]).join(',');
    const csvRows = filteredRecords.map(row => 
      Object.values(row).map(val => `"${val !== null ? String(val).replace(/"/g, '""') : ''}"`).join(',')
    );
    const csvString = [headers, ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "filtrelenmis_uretim_raporu.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center"><FilterIcon className="mr-2" size={20}/> Gelişmiş Sorgulama ({filteredRecords.length} Kayıt)</h2>
          <button onClick={handleExportCSV} disabled={filteredRecords.length === 0} className="flex items-center px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
            <Download size={16} className="mr-2"/> CSV İndir
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Tarih Aralığı</label>
              <div className="flex space-x-2"><input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md text-sm p-2 border" /><input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md text-sm p-2 border" /></div>
            </div>
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Stok Adı / Ürün (Arama)</label>
              <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400"/><input type="text" placeholder="Ürün adı..." value={filters.stockName} onChange={e => setFilters({...filters, stockName: e.target.value})} className="w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white pl-9 rounded-md text-sm p-2 border" /></div>
            </div>
          </div>
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Vardiya</label>
              <div className="flex space-x-4">{[1, 2, 3].map(s => (<label key={s} className="flex items-center text-sm cursor-pointer dark:text-slate-300"><input type="checkbox" checked={filters.shifts.includes(s)} onChange={() => toggleArrayFilter('shifts', s)} className="mr-2"/> Vardiya {s}</label>))}</div>
            </div>
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">İş İstasyonu</label>
              <select multiple value={filters.workstations} onChange={e => setFilters({...filters, workstations: Array.from(e.target.selectedOptions, o => o.value)})} className="w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md text-sm p-2 border h-20 bg-slate-50 dark:bg-slate-800">{uniqueWorkstations.map(w => <option key={w} value={w}>{w}</option>)}</select>
            </div>
          </div>
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Minimum OEE Değeri: %{filters.minOee}</label><input type="range" min="0" max="100" value={filters.minOee} onChange={e => setFilters({...filters, minOee: Number(e.target.value)})} className="w-full mt-2" /></div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-3">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Kayıt Durumu</label>
              <select value={filters.statusFilter} onChange={e => setFilters({...filters, statusFilter: e.target.value})} className="w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md text-sm p-2 border bg-white dark:bg-slate-800">
                <option value="all">Tüm Kayıtlar</option>
                <option value="valid">✅ Sadece Geçerli Kayıtlar</option>
                <option value="warning">⚠️ Sadece Uyarılar</option>
                <option value="error">❌ Sadece Kesin Hatalı Kayıtlar</option>
              </select>
              
              {['warning', 'error'].includes(filters.statusFilter) && uniqueErrorTypes.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Hata Nedeni / Tipi</label>
                  <select value={filters.errorType} onChange={e => setFilters({...filters, errorType: e.target.value})} className="w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md text-sm p-2 border bg-white dark:bg-slate-800">
                    <option value="">Tüm Hata Tipleri</option>
                    {uniqueErrorTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[60vh] border-t border-slate-200 dark:border-slate-700">
          {loading ? <div className="p-8 text-center text-slate-500 dark:text-slate-400">Veriler yükleniyor...</div> : (
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300 whitespace-nowrap">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-900/80 sticky top-0 shadow-sm z-10">
                <tr><th className="px-6 py-3">ID</th><th className="px-6 py-3">Tarih</th><th className="px-6 py-3">Vardiya</th><th className="px-6 py-3">İstasyon</th><th className="px-6 py-3">Stok Adı</th><th className="px-6 py-3">OEE</th><th className="px-6 py-3">Durum</th></tr>
              </thead>
              <tbody>
                {filteredRecords.map(r => (
                  <tr key={r.record_id} className={`border-b dark:border-slate-700 ${r.is_valid ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50' : 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40'}`}>
                <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">#{r.record_id}</td>
                <td className="px-6 py-3">{r.date}</td>
                <td className="px-6 py-3">{r.shift}</td>
                <td className="px-6 py-3">{r.workstation_name}</td>
                <td className="px-6 py-3 truncate max-w-[200px]">{r.stock_name}</td>
                <td className="px-6 py-3 font-semibold">% {r.oee?.toFixed(2) || 'N/A'}</td>
                <td className="px-6 py-3 overflow-visible relative">
                  {r.is_valid ? (
                    <span className="text-green-600 flex items-center"><CheckCircle size={14} className="mr-1"/> Geçerli</span>
                  ) : (
                    <div className="group flex items-center">
                          <span className={`flex items-center cursor-help font-medium ${r.record_status === 'warning' ? 'text-orange-500' : 'text-red-600'}`}>
                            <AlertCircle size={14} className="mr-1"/> {r.record_status === 'warning' ? 'Uyarı' : 'Hatalı'}
                          </span>
                      <div className="absolute right-0 top-full mt-1 hidden group-hover:block w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg p-3 z-50">
                        <p className="text-xs font-bold text-slate-800 dark:text-white mb-2 border-b border-slate-100 dark:border-slate-700 pb-1">Hata Detayları:</p>
                        <ul className="text-[11px] space-y-2 text-slate-600 dark:text-slate-400 whitespace-normal">
                          {parseErrors(r.validation_errors).map((err, i) => (
                            <li key={i} className="flex flex-col"><span className="font-semibold text-red-500 block">• {err.error_type}</span><span>{err.message || err}</span>{err.reason && <span className="italic opacity-80 mt-0.5 text-slate-500 block">💡 {err.reason}</span>}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}