import { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Filter as FilterIcon, Search, CheckCircle, AlertCircle } from 'lucide-react';

export default function Filter() {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '', endDate: '', shifts: [], workstations: [], stockName: '', minOee: 0, showSuspicious: false
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
    if (filters.showSuspicious) data = data.filter(r => r.is_valid === false);
    setFilteredRecords(data);
  };

  const toggleArrayFilter = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter(v => v !== value) : [...prev[field], value]
    }));
  };

  const uniqueWorkstations = [...new Set(records.map(r => r.workstation_name).filter(Boolean))];

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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center"><FilterIcon className="mr-2" size={20}/> Gelişmiş Sorgulama ({filteredRecords.length} Kayıt)</h2>
          <button onClick={handleExportCSV} disabled={filteredRecords.length === 0} className="flex items-center px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
            <Download size={16} className="mr-2"/> CSV İndir
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tarih Aralığı</label>
              <div className="flex space-x-2"><input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full border-slate-300 rounded-md text-sm p-2 border" /><input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full border-slate-300 rounded-md text-sm p-2 border" /></div>
            </div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Stok Adı / Ürün (Arama)</label>
              <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400"/><input type="text" placeholder="Ürün adı..." value={filters.stockName} onChange={e => setFilters({...filters, stockName: e.target.value})} className="w-full border-slate-300 pl-9 rounded-md text-sm p-2 border" /></div>
            </div>
          </div>
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Vardiya</label>
              <div className="flex space-x-4">{[1, 2, 3].map(s => (<label key={s} className="flex items-center text-sm cursor-pointer"><input type="checkbox" checked={filters.shifts.includes(s)} onChange={() => toggleArrayFilter('shifts', s)} className="mr-2"/> Vardiya {s}</label>))}</div>
            </div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">İş İstasyonu</label>
              <select multiple value={filters.workstations} onChange={e => setFilters({...filters, workstations: Array.from(e.target.selectedOptions, o => o.value)})} className="w-full border-slate-300 rounded-md text-sm p-2 border h-20 bg-slate-50">{uniqueWorkstations.map(w => <option key={w} value={w}>{w}</option>)}</select>
            </div>
          </div>
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Minimum OEE Değeri: %{filters.minOee}</label><input type="range" min="0" max="100" value={filters.minOee} onChange={e => setFilters({...filters, minOee: Number(e.target.value)})} className="w-full mt-2" /></div>
            <div className="pt-4 border-t border-slate-100">
              <label className="flex items-center cursor-pointer p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 font-medium text-sm transition-colors hover:bg-orange-100"><input type="checkbox" checked={filters.showSuspicious} onChange={e => setFilters({...filters, showSuspicious: e.target.checked})} className="mr-3 w-5 h-5 accent-orange-600 rounded"/>Sadece Şüpheli / Hatalı Kayıtları Göster</label>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[60vh] border-t border-slate-200">
          {loading ? <div className="p-8 text-center text-slate-500">Veriler yükleniyor...</div> : (
            <table className="w-full text-sm text-left text-slate-600 whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-100 sticky top-0 shadow-sm z-10">
                <tr><th className="px-6 py-3">ID</th><th className="px-6 py-3">Tarih</th><th className="px-6 py-3">Vardiya</th><th className="px-6 py-3">İstasyon</th><th className="px-6 py-3">Stok Adı</th><th className="px-6 py-3">OEE</th><th className="px-6 py-3">Durum</th></tr>
              </thead>
              <tbody>
                {filteredRecords.map(r => (
                  <tr key={r.record_id} className={`border-b ${r.is_valid ? 'hover:bg-slate-50' : 'bg-red-50 hover:bg-red-100'}`}>
                    <td className="px-6 py-3 font-medium text-slate-900">#{r.record_id}</td><td className="px-6 py-3">{r.date}</td><td className="px-6 py-3">{r.shift}</td><td className="px-6 py-3">{r.workstation_name}</td><td className="px-6 py-3 truncate max-w-[200px]">{r.stock_name}</td><td className="px-6 py-3 font-semibold">% {r.oee?.toFixed(2) || 'N/A'}</td><td className="px-6 py-3">{r.is_valid ? <span className="text-green-600 flex items-center"><CheckCircle size={14} className="mr-1"/> Geçerli</span> : <span className="text-red-600 flex items-center"><AlertCircle size={14} className="mr-1"/> Hatalı</span>}</td>
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