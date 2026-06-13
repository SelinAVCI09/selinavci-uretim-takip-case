import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle, Edit2, Trash2, Save, X, History, Settings, Filter as FilterIcon, Search, RefreshCw, BarChart2, Download } from 'lucide-react';

export default function Validation() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [expandedHistory, setExpandedHistory] = useState({});
  
  // Yeni Eklentiler (Filtreleme & Ayarlar)
  const [validationSettings, setValidationSettings] = useState({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: '', errorType: '' });

  // Veritabanında eski formattaki hatalar varsa sayfanın çökmesini (beyaz ekran) engeller
  const parseErrors = (errString) => {
    if (!errString || errString === "null") return [];
    if (typeof errString === 'object') return Array.isArray(errString) ? errString : [errString];
    try {
      const parsed = JSON.parse(errString);
      return Array.isArray(parsed) ? parsed : [{ message: errString, error_type: 'Bilinmeyen Hata', action: 'uyar', field: 'Bilinmiyor' }];
    } catch {
      return [{ message: errString, error_type: 'Bilinmeyen Hata', action: 'uyar', field: 'Bilinmiyor' }];
    }
  };

  // Geçmiş düzenleme kayıtlarının React'i çökertmesini engeller
  const parseAuditTrail = (trailString) => {
    if (!trailString || trailString === "null") return [];
    if (typeof trailString === 'object') return Array.isArray(trailString) ? trailString : [trailString];
    try {
      const parsed = JSON.parse(trailString);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  useEffect(() => {
    fetchSuspiciousRecords();
    fetchSettings();
  }, []);

  const fetchSuspiciousRecords = async () => {
    try {
      // is_valid=false olan yani sadece şüpheli kayıtları çekiyoruz
      const response = await axios.get('http://localhost:8000/api/v1/records?is_valid=false');
      setRecords(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Kayıtlar çekilirken hata oluştu', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/v1/validation-settings');
      setValidationSettings(response.data || {});
    } catch (error) {
      console.error('Ayarlar çekilemedi', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await axios.put('http://localhost:8000/api/v1/validation-settings', validationSettings);
      setIsSettingsOpen(false);
      await handleRevalidate(); // Yeni kuralları anında uygula ve tabloyu güncelle
    } catch (error) {
      console.error('Ayarlar kaydedilemedi', error);
      alert('Ayarlar kaydedilemedi.');
    }
  };

  const handleRevalidate = async () => {
    setIsRevalidating(true);
    try {
      await axios.post('http://localhost:8000/api/v1/revalidate');
      await fetchSuspiciousRecords();
      alert('Veritabanındaki tüm veriler yeni kurallara göre yeniden doğrulandı.');
    } catch (error) {
      console.error('Yeniden doğrulama hatası', error);
    } finally {
      setIsRevalidating(false);
    }
  };

  const SETTINGS_INFO = {
    missing_wo: { label: "Eksik İş Emri", desc: "İş emri no boş bırakılamaz." },
    format_wo: { label: "İş Emri Formatı", desc: "Standart format (302 ile başlar, 10 hane)." },
    invalid_shift: { label: "Vardiya Kontrolü", desc: "Vardiya 1, 2 veya 3 olmalıdır." },
    missing_ws: { label: "Eksik İş İstasyonu", desc: "İş İstasyonu alanı zorunludur." },
    negative_prod: { label: "Geçersiz Üretim Miktarı", desc: "Üretim en az 1 olmalı, fire negatif olamaz." },
    scrap_gt_prod: { label: "Fire > Toplam Üretim", desc: "Fire miktarı üretimden büyük olamaz." },
    out_of_range_pct: { label: "Yüzdelik Aralık", desc: "A, P, Q ve OEE 0-100 arasında olmalıdır." },
    capacity_exceed: { label: "Kapasite Aşımı (Uyarı)", desc: "Performans %100'ü aşarsa uyar." },
    downtime_mismatch: { label: "Duruş Tutarsızlığı", desc: "Toplam Duruş = Planlı + Plansız Duruş." },
    downtime_gt_worktime: { label: "Duruş > Çalışma Süresi", desc: "Duruş, çalışma süresini geçemez." },
    prod_zero_worktime: { label: "Süresiz Üretim", desc: "Çalışma süresi sıfırken üretim yapılamaz." },
    avail_100_with_downtime: { label: "Duruş Varken A=%100", desc: "Duruş varsa Kullanılabilirlik (A) %100 olamaz." },
    invalid_date: { label: "Geçersiz/Gelecek Tarih", desc: "Tarih boş veya bugünden ileri olamaz." },
    oee_mismatch: { label: "OEE Hesabı Hatası", desc: "A * P * Q ile Raporlanan OEE eşleşmelidir." }
  };

  // Filtreleme İşlemi (Arama, Durum ve Hata Tipi)
  const safeRecords = Array.isArray(records) ? records : [];
  const uniqueErrorTypes = [...new Set(
    safeRecords.reduce((acc, r) => {
      return acc.concat(parseErrors(r?.validation_errors).map(err => err?.error_type).filter(Boolean));
    }, [])
  )];
  
  const filteredRecords = safeRecords.filter(r => {
    const search = filters.search.toLowerCase();
    const matchSearch = search === '' || 
      String(r?.work_order_no || '').toLowerCase().includes(search) || 
      String(r?.stock_name || '').toLowerCase().includes(search) || 
      String(r?.record_id || '').includes(search);
    const matchStatus = filters.status === '' || r?.record_status === filters.status;
    const matchErrorType = filters.errorType === '' || parseErrors(r?.validation_errors).some(e => e?.error_type === filters.errorType);
    return matchSearch && matchStatus && matchErrorType;
  });

  const toggleHistory = (recordId) => {
    setExpandedHistory(prev => ({ ...prev, [recordId]: !prev[recordId] }));
  };

  const handleEditClick = (record) => {
    setEditingRecordId(record.record_id);
    setEditFormData({ ...record });
  };

  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setEditFormData({});
  };

  const handleInputChange = (e, field) => {
    let value = e.target.value;
    if (e.target.type === 'number') {
      value = value === '' ? null : Number(value);
    }
    setEditFormData({ ...editFormData, [field]: value });
  };

  const handleSave = async (recordId) => {
    try {
      const { record_id, is_valid, validation_errors, audit_trail, ...updateData } = editFormData;
      const response = await axios.put(`http://localhost:8000/api/v1/records/${recordId}`, updateData);
      
      if (response.data.is_valid) {
        setRecords(safeRecords.filter(r => r.record_id !== recordId));
      } else {
        setRecords(safeRecords.map(r => r.record_id === recordId ? { 
          ...editFormData, 
          validation_errors: JSON.stringify(response.data.errors),
          audit_trail: JSON.stringify(response.data.audit_trail)
        } : r));
      }
      setEditingRecordId(null);
    } catch (error) {
      console.error('Kayıt güncellenirken hata oluştu', error);
      alert('Kayıt güncellenemedi. Lütfen alanları kontrol ediniz.');
    }
  };

  const handleReject = async (recordId) => {
    if (!window.confirm('Bu kaydı reddetmek ve sistemden tamamen silmek istediğinize emin misiniz?')) return;
    try {
      await axios.delete(`http://localhost:8000/api/v1/records/${recordId}`);
      setRecords(safeRecords.filter(r => r.record_id !== recordId));
    } catch (error) {
      console.error('Kayıt reddedilirken hata oluştu', error);
      alert('Kayıt silinemedi.');
    }
  };

  // İstatistik Rapor Verileri
  const errorCount = safeRecords.filter(r => r?.record_status === 'error').length;
  const warningCount = safeRecords.filter(r => r?.record_status === 'warning').length;

  const getActionColor = (action) => {
    switch(action) {
      case 'reddet': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'düzelt': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'uyar': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  // Filtrelenen veriyi CSV olarak indirme foksiyonu
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return alert('İndirilecek kayıt bulunamadı.');
    
    const headers = ["Kayit_ID", "Is_Emri", "Vardiya", "Toplam_Uretim", "Fire", "OEE", "Durum", "Hata_Sayisi"];
    const csvRows = filteredRecords.map(r => {
      const errorCount = parseErrors(r.validation_errors).length;
      return [
        r.record_id, r.work_order_no || 'Eksik', r.shift || '', r.total_produced || 0, 
        r.scrap_qty || 0, r.oee || '', r.record_status, errorCount
      ].join(",");
    });
    
    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows].join("\n"); // UTF-8 BOM ekliyoruz (Türkçe karakterler için)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `validation_raporu_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Üst Bilgi ve Butonlar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
            <AlertTriangle className="mr-3 text-orange-500" /> Veri Validasyonu ve Kalite Raporu
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Sistem kalite kurallarına takılan şüpheli kayıtları yönetin ve validasyon kurallarını ayarlayın.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm shadow-sm">
            <Download size={16} className="mr-2" /> CSV İndir
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium text-sm shadow-sm">
            <Settings size={16} className="mr-2" /> Validasyon Ayarları
          </button>
          <button onClick={handleRevalidate} disabled={isRevalidating} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium text-sm shadow-sm">
            <RefreshCw size={16} className={`mr-2 ${isRevalidating ? 'animate-spin' : ''}`} /> {isRevalidating ? 'Doğrulanıyor...' : 'Tüm Kayıtları Yeniden Doğrula'}
          </button>
        </div>
      </div>

      {/* Kalite Raporu (Özet Kartları) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
          <div className="p-3 bg-slate-100 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 rounded-lg mr-4"><BarChart2 size={24}/></div>
          <div><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Toplam Şüpheli Kayıt</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{safeRecords.length}</h3></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-red-200 dark:border-red-900/30 shadow-sm flex items-center">
          <div className="p-3 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg mr-4"><AlertTriangle size={24}/></div>
          <div><p className="text-xs font-bold text-red-500 dark:text-red-400 uppercase">Kesin Hatalı (Müdahale Şart)</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{errorCount}</h3></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-orange-200 dark:border-orange-900/30 shadow-sm flex items-center">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-lg mr-4"><AlertTriangle size={24}/></div>
          <div><p className="text-xs font-bold text-orange-500 dark:text-orange-400 uppercase">Sadece Uyarı Niteliğinde</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{warningCount}</h3></div>
        </div>
      </div>

      {/* Veri Tablosu ve Filtreler */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        
        {/* Tablo İçi Filtreleme Çubuğu */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
            <input type="text" placeholder="İş Emri, Stok Adı veya Kayıt ID Ara..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
          <div className="flex gap-2">
            <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white outline-none">
              <option value="">Tüm Durumlar</option>
              <option value="error">❌ Kesin Hatalı</option>
              <option value="warning">⚠️ Sadece Uyarı</option>
            </select>
            <select value={filters.errorType} onChange={e => setFilters({...filters, errorType: e.target.value})} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white outline-none max-w-[200px]">
              <option value="">Tüm Hata Tipleri</option>
              {uniqueErrorTypes.map(t => {
                const safeT = typeof t === 'object' ? JSON.stringify(t) : String(t);
                return <option key={safeT} value={safeT}>{safeT}</option>
              })}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">Kayıtlar yükleniyor...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            {safeRecords.length === 0 ? (
              <><CheckCircle size={48} className="text-green-500 mb-4" /><h3 className="text-lg font-bold text-slate-700 dark:text-white">Tebrikler! Şüpheli kayıt yok.</h3><p className="text-slate-500 dark:text-slate-400">Yüklenen tüm veriler kalite testinden başarıyla geçti.</p></>
            ) : (
              <><FilterIcon size={48} className="text-slate-400 mb-4 opacity-50" /><h3 className="text-lg font-bold text-slate-700 dark:text-white">Sonuç Bulunamadı</h3><p className="text-slate-500 dark:text-slate-400">Arama veya filtre kriterlerinize uyan kayıt yok.</p></>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
              <thead className="text-xs text-slate-700 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">Kayıt ID</th>
                  <th className="px-6 py-4">İş Emri / Stok</th>
                  <th className="px-6 py-4">Metrikler</th>
                  <th className="px-6 py-4 w-1/3">Validation Report (Hatalar)</th>
                  <th className="px-6 py-4 text-center">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                 <React.Fragment key={record.record_id}> 
                    <tr className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex flex-col items-start gap-1.5">
                          <span>#{record.record_id}</span>
                          {record.record_status === 'error' ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded text-[10px] font-bold uppercase whitespace-nowrap tracking-wider">Kesin Hatalı</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 rounded text-[10px] font-bold uppercase whitespace-nowrap tracking-wider">Uyarı</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="dark:text-slate-200 font-semibold">{record.work_order_no || 'Eksik İş Emri'}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">{record.stock_name || 'Bilinmeyen Stok'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="dark:text-slate-200 text-sm">OEE: %{record.oee !== null ? record.oee : 'N/A'}</div> 
                        <div className="dark:text-slate-400 text-xs mt-1">Üretim: {record.total_produced} | Fire: {record.scrap_qty}</div>
                        <div className="dark:text-slate-400 text-xs">Duruş: {record.down_time}dk</div>
                        
                        {parseAuditTrail(record.audit_trail).length > 0 && (
                          <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-2">
                            <button onClick={() => toggleHistory(record.record_id)} className="flex items-center text-[10px] text-indigo-500 hover:text-indigo-600 font-medium">
                              <History size={12} className="mr-1" /> Geçmiş ({parseAuditTrail(record.audit_trail).length})
                            </button>
                            {expandedHistory[record.record_id] && (
                              <div className="mt-2 space-y-1 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded text-[10px]">
                                {parseAuditTrail(record.audit_trail).map((log, idx) => (
                                  <div key={idx} className="border-b border-indigo-100 dark:border-indigo-800/30 pb-1 last:border-0 last:pb-0">
                                    <span className="text-slate-500 block mb-0.5">{log?.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : 'Bilinmeyen Tarih'}</span>
                                    {Array.isArray(log?.changes) && log.changes.map((c, i) => (
                                      <div key={i} className="text-indigo-700 dark:text-indigo-300">
                                        <span className="font-semibold">{c?.field}:</span> {String(c?.old ?? 'N/A')} &rarr; {String(c?.new ?? 'N/A')}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          {parseErrors(record.validation_errors).map((err, i) => {
                            const isComplex = typeof err === 'object' && err !== null;
                            const msg = isComplex ? err.message : err;
                            const type = isComplex ? err.error_type : 'Bilinmeyen Hata';
                            const action = isComplex ? err.action : 'uyar';
                            const reason = isComplex ? err.reason : null;
                            const field = isComplex ? err.field : 'N/A';
                            
                            const safeMsg = typeof msg === 'object' ? JSON.stringify(msg) : String(msg || '');
                            const safeReason = typeof reason === 'object' ? JSON.stringify(reason) : reason;
                            
                            return (
                              <div key={i} className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-3 rounded-lg text-xs flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-red-700 dark:text-red-400">{String(type || '')}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getActionColor(action)}`}>
                                    Öneri: {String(action || '')}
                                  </span>
                                </div>
                                <span className="text-slate-700 dark:text-slate-300 mt-1">{safeMsg}</span>
                                {safeReason && (
                                  <span className="text-slate-500 dark:text-slate-400 mt-1 italic text-[11px] block">💡 {String(safeReason)}</span>
                                )}
                                <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px] mt-1">İlgili Alan(lar): {String(field || '')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 items-center justify-center">
                          <button onClick={() => handleEditClick(record)} className="flex items-center justify-center w-full px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors text-xs font-medium border border-blue-200 dark:border-blue-800">
                            <Edit2 size={14} className="mr-1.5" /> Düzelt
                          </button>
                          <button onClick={() => handleReject(record.record_id)} className="flex items-center justify-center w-full px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors text-xs font-medium border border-red-200 dark:border-red-800">
                            <Trash2 size={14} className="mr-1.5" /> Reddet
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Düzeltme Formu Satırı */}
                    {editingRecordId === record.record_id && (
                      <tr className="bg-slate-50 dark:bg-slate-900/80 border-b-2 border-blue-500">
                        <td colSpan="5" className="p-6">
                          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                            <h4 className="font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Kayıt Düzenle: #{record.record_id}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">İş Emri No</label>
                                <input type="text" value={editFormData.work_order_no || ''} onChange={(e) => handleInputChange(e, 'work_order_no')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Vardiya</label>
                                <input type="number" value={editFormData.shift ?? ''} onChange={(e) => handleInputChange(e, 'shift')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Toplam Üretim</label>
                                <input type="number" value={editFormData.total_produced ?? ''} onChange={(e) => handleInputChange(e, 'total_produced')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Fire (Scrap)</label>
                                <input type="number" value={editFormData.scrap_qty ?? ''} onChange={(e) => handleInputChange(e, 'scrap_qty')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">OEE (%)</label>
                                <input type="number" step="0.1" value={editFormData.oee ?? ''} onChange={(e) => handleInputChange(e, 'oee')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Toplam Duruş (dk)</label>
                                <input type="number" step="0.1" value={editFormData.down_time ?? ''} onChange={(e) => handleInputChange(e, 'down_time')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Planlı Duruş (dk)</label>
                                <input type="number" step="0.1" value={editFormData.planned_down_time ?? ''} onChange={(e) => handleInputChange(e, 'planned_down_time')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Plansız Duruş (dk)</label>
                                <input type="number" step="0.1" value={editFormData.unplanned_down_time ?? ''} onChange={(e) => handleInputChange(e, 'unplanned_down_time')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
                              <button onClick={handleCancelEdit} className="px-4 py-2 flex items-center text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors">
                                <X size={16} className="mr-2" /> İptal
                              </button>
                              <button onClick={() => handleSave(record.record_id)} className="px-4 py-2 flex items-center text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                                <Save size={16} className="mr-2" /> Kaydet ve Tekrar Doğrula
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Validasyon Ayarları Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center"><Settings className="mr-2" size={20} /> Validasyon Kuralları & Filtre Ayarları</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/20">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Sistemin verileri denetlerken kullanacağı kalite kurallarını buradan açıp kapatabilirsiniz. Kapattığınız kurallar sebebiyle daha önce hata fırlatan kayıtları temize çekmek için işlemi kaydettikten sonra <strong>"Yeniden Doğrula"</strong> butonuna tıklamayı unutmayın.
              </p>
              <div className="space-y-3">
                {Object.keys(validationSettings || {}).map(key => (
                  <div key={key} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                    <div className="pr-4">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">{SETTINGS_INFO[key]?.label || key}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{SETTINGS_INFO[key]?.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input type="checkbox" className="sr-only peer" checked={!!(validationSettings || {})[key]} onChange={(e) => setValidationSettings({ ...(validationSettings || {}), [key]: e.target.checked })} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-end gap-3">
              <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-sm">İptal</button>
              <button onClick={handleSaveSettings} className="px-4 py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm flex items-center">
                <Save size={16} className="mr-2" /> Ayarları Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}