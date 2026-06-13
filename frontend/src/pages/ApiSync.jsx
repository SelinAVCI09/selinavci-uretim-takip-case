import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Send, Clock, CheckCircle, AlertTriangle, RefreshCw, Server, XCircle, Database, Calendar, Info, Download, Settings, X, Save } from 'lucide-react';

export default function ApiSync() {
  const [preview, setPreview] = useState(null);
  const [syncState, setSyncState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingManual, setSendingManual] = useState(null);

  // API Ayarları için State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiSettings, setApiSettings] = useState({ api_key: '', external_api_url: '' });

  const fetchDashboard = async () => {
    try {
      const [prevRes, stateRes, logRes] = await Promise.all([
        axios.get('http://localhost:8000/api/v1/sync/preview'),
        axios.get('http://localhost:8000/api/v1/sync/status'),
        axios.get('http://localhost:8000/api/v1/sync/logs')
      ]);
      setPreview(prevRes.data);
      setSyncState(stateRes.data);
      setLogs(logRes.data);
      
      // Inspect (Console) ekranında detaylı logları görmek için eklendi:
      if (logRes.data.length > 0) console.log("--- HEDEF API İLETİŞİM LOGLARI ---", logRes.data);
    } catch (err) {
      console.error("Senkronizasyon verileri çekilemedi", err);
    } finally {
      setLoading(false);
    }
  };

  // Arkaplanda gönderim varsa her 2 saniyede bir ekranı güncelle
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => {
      if (syncState?.is_syncing) fetchDashboard();
    }, 2000);
    return () => clearInterval(interval);
  }, [syncState?.is_syncing]);

  const handleStartSync = async () => {
    try {
      await axios.post('http://localhost:8000/api/v1/sync/start');
      fetchDashboard();
    } catch (err) {
      alert('Senkronizasyon başlatılırken hata oluştu.');
    }
  };

  const handleManualSend = async (payload) => {
    const key = `${payload.production_date}-${payload.shift}`;
    setSendingManual(key);
    try {
      await axios.post('http://localhost:8000/api/v1/sync/manual', payload);
      // Gönderim bittikten sonra tabloyu ve logları güncelle
      fetchDashboard();
    } catch (err) {
      console.error("Manuel gönderim hatası", err);
      alert('Manuel gönderim sırasında hata oluştu.');
      fetchDashboard(); // Başarısız bile olsa logu çekmek için
    } finally {
      setSendingManual(null);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await axios.put('http://localhost:8000/api/v1/sync/settings', apiSettings);
      setIsSettingsOpen(false);
      
      // Yeni özellik: Tıpkı validasyon sayfasındaki gibi ayarlar kaydedilir kaydedilmez otomatik tetikleme
      if (window.confirm("Hedef API Ayarları başarıyla güncellendi!\n\nBekleyen veya daha önce hata almış veriler yeni ayarlarla ŞİMDİ gönderilsin mi?")) {
        handleStartSync();
      } else {
        fetchDashboard(); // En azından verileri tazeleyelim
      }
    } catch (err) {
      alert("Ayarlar kaydedilirken hata oluştu.");
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm("Tüm gönderim geçmişi (loglar) silinecek. Emin misiniz?")) return;
    try {
      await axios.delete('http://localhost:8000/api/v1/sync/logs');
      fetchDashboard();
    } catch (err) {
      alert("Loglar silinirken hata oluştu.");
    }
  };

  // Bekleyen (Gönderilecek) paketleri Excel/CSV olarak indirme
  const handleExportCSV = () => {
    if (!preview || !preview.pending_payloads || preview.pending_payloads.length === 0) {
      return alert('İndirilecek kayıt bulunamadı.');
    }

    const headers = ["Uretim_Tarihi", "Vardiya", "OEE", "Toplam_Uretim", "Makine_Sayisi", "Istasyonlar"];
    const csvRows = preview.pending_payloads.map(p => {
      // İstasyon isimleri arasında virgül olabileceği için tırnak içine alıyoruz (Excel'de sütun kaymasını engeller)
      const machinesStr = `"${(p.machines || []).join(', ')}"`;
      return [
        p.production_date, p.shift, p.oe_value, p.total_production_units, p.machine_count, machinesStr
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows].join("\n"); // Türkçe karakterler için BOM eklendi
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `gonderilecek_vardiyalar_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Gün x Vardiya Matrisini Oluşturma
  const matrixData = useMemo(() => {
    if (!preview || !logs || preview.total_records === 0) return [];
    const matrix = {};

    // 1. Önce veritabanındaki GÜNCEL (Ayarlara göre yeniden hesaplanmış) verileri yerleştir.
    // Bu sayede siz ayarları değiştirdiğinizde daha önce gönderilmiş olan hücrelerin bile OEE/Üretim rakamları anında güncellenir.
    (preview.all_payloads || preview.pending_payloads || []).forEach(payload => {
      if (!matrix[payload.production_date]) matrix[payload.production_date] = { 1: null, 2: null, 3: null };
      matrix[payload.production_date][payload.shift] = {
        status: 'PENDING',
        payload: payload
      };
    });

    // 2. Logları (Geçmiş işlemleri) inceleyerek hücrelerin durumlarını belirle
    // Loglar en yeniden eskiye sıralıdır. Her bir tarih-vardiya için EN SON işlemi buluyoruz.
    const latestLogs = {};
    logs.forEach(log => {
      const key = `${log.production_date}-${log.shift}`;
      if (!latestLogs[key]) latestLogs[key] = log;
    });

    // 3. En son log durumlarına göre matris hücrelerini ez ve durumunu güncelle
    Object.keys(latestLogs).forEach(key => {
      const log = latestLogs[key];
      
      const rowExists = !!matrix[log.production_date];
      const cell = rowExists ? matrix[log.production_date][log.shift] : null;

      // Eğer sistemde o vardiya için artık GEÇERLİ (Temiz) bir kayıt kalmadıysa,
      // geçmiş log başarılı ("Aktarıldı") olsa bile bunu matriste hayalet olarak GÖSTERME!
      // Çünkü veritabanı sıfırlanmış veya o kayıt artık listeden silinmiş demektir.
      if (!cell) {
        return;
      }

      matrix[log.production_date][log.shift] = {
        status: log.is_success ? 'SUCCESS' : 'RETRY',
        statusCode: log.status_code,
        errorMsg: !log.is_success ? log.response_data : null,
        payload: cell.payload // Sadece güncel ve var olan datayı kullan
      };
    });

    // Tüm günleri göster ama eğer hayaletleri sildiğimiz için gün tamamen boş (null) kaldıysa o günü gizle
    return Object.keys(matrix)
      .filter(date => matrix[date][1] || matrix[date][2] || matrix[date][3])
      .sort((a, b) => new Date(b) - new Date(a))
      .map(date => ({
        date,
        shifts: matrix[date]
      }));
  }, [preview, logs]);

  const stats = useMemo(() => {
    const pending = preview?.pending_payloads?.length || 0;
    return { pending };
  }, [preview]);

  if (loading) return <div className="p-8 text-center text-slate-500">Veriler yükleniyor...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
            <Server className="mr-3 text-indigo-500" /> Hedef Sistem API Senkronizasyonu
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Validasyon testini başarıyla geçen kayıtları gruplayarak (Tarih ve Vardiya bazında) dış API'ye aktarın.
          </p>
        </div>
        <button onClick={() => setIsSettingsOpen(true)} className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium text-sm shadow-sm">
          <Settings size={16} className="mr-2" /> API Ayarları
        </button>
      </div>

      {/* Senkronizasyon Kontrol Paneli */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center">
            <div className={`p-4 rounded-full mr-5 ${syncState?.is_syncing ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50' : 'bg-slate-100 text-slate-600 dark:bg-slate-700'}`}>
               <Send size={32} className={syncState?.is_syncing ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
                {syncState?.is_syncing ? 'Aktarım Devam Ediyor...' : 'Aktarıma Hazır Veriler'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {!syncState?.is_syncing ? (
                  stats.pending > 0 
                    ? <span><strong>{preview?.pending_raw_records || 0} adet temiz kayıt</strong> birleştirilerek <strong>{stats.pending} vardiya paketi</strong> olarak gönderilmeyi bekliyor.</span>
                    : <span>Tüm veriler güncel. Gönderilecek yeni kayıt bulunamadı.</span>
                ) : (
                  <span>Hedef sistem API'si ile haberleşiliyor. Arkaplanda işleniyor...</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex-shrink-0 w-full md:w-auto flex flex-col gap-3">
            {!syncState?.is_syncing ? (
              <div className="flex flex-col md:flex-row gap-3">
                <button 
                  onClick={handleExportCSV} 
                  disabled={stats.pending === 0}
                  className="w-full md:w-auto flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-md"
                >
                  <Download size={18} className="mr-2" /> Excel'e Aktar
                </button>
                <button 
                  onClick={handleStartSync} 
                  disabled={stats.pending === 0}
                  className="w-full md:w-auto flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-md"
                >
                  <RefreshCw size={18} className="mr-2" /> Senkronizasyonu Başlat
                </button>
              </div>
            ) : (
              <div className="w-full md:w-64">
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <span>İlerleme</span>
                  <span>{syncState.processed} / {syncState.total}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-2">
                  <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(syncState.processed / syncState.total) * 100}%` }}></div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-600 dark:text-green-400">{syncState.success} Başarılı</span>
                  <span className="text-red-600 dark:text-red-400">{syncState.failed} Hatalı</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-6 text-sm">
          <div className="flex items-center text-slate-600 dark:text-slate-300"><Database size={16} className="mr-2 text-slate-400"/> Idempotent Gönderim Aktif</div>
          <div className="flex items-center text-slate-600 dark:text-slate-300"><RefreshCw size={16} className="mr-2 text-slate-400"/> Fallback & Retry Aktif</div>
          <div className="flex items-center text-slate-600 dark:text-slate-300"><Clock size={16} className="mr-2 text-slate-400"/> Arkaplan (Async) İşlem Aktif</div>
        </div>
      </div>

      {/* Gün x Vardiya Matrisi (Önizleme) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
              <Calendar size={18} className="mr-2 text-indigo-500"/> Gün × Vardiya Matrisi (Gönderim Önizlemesi)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sadece hedef sisteme gidecek veya hata almış kayıtların kırılımını gösterir.</p>
          </div>
          <div className="flex gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-100 border border-blue-300 mr-1.5"></span> Bekliyor</span>
            <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-orange-100 border border-orange-300 mr-1.5"></span> Yeniden Denenecek</span>
            <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-100 border border-green-300 mr-1.5"></span> Gönderildi</span>
          </div>
        </div>
        
        {matrixData.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <Info size={40} className="text-slate-300 mb-3" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-white">Gösterilecek Veri Yok</h3>
            <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">Sistemde henüz valide edilmiş veya senkronize edilmiş hiçbir vardiya verisi bulunmuyor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100/50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 w-40 font-bold border-r border-slate-200 dark:border-slate-700">Üretim Tarihi</th>
                  <th className="px-6 py-4 text-center">Vardiya 1 (Sabah)</th>
                  <th className="px-6 py-4 text-center">Vardiya 2 (Öğle)</th>
                  <th className="px-6 py-4 text-center">Vardiya 3 (Gece)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {matrixData.map(row => (
                  <tr key={row.date} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-700/50 whitespace-nowrap">
                      {new Date(row.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    {[1, 2, 3].map(shiftNum => {
                      const cell = row.shifts[shiftNum];
                      const cellKey = `${row.date}-${shiftNum}`;
                      const isSending = sendingManual === cellKey;
                      return (
                        <td key={shiftNum} className="px-3 py-3 align-top">
                          {!cell ? (
                            <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                              -
                            </div>
                          ) : cell.status === 'SUCCESS' ? (
                            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3 h-full relative transition-all duration-500">
                              <div className="flex items-center justify-center mb-2">
                                <CheckCircle size={16} className="text-green-500 mr-1.5" />
                                <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">Aktarıldı</span>
                              </div>
                              {cell.payload && (
                                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 mt-2 border-t border-green-200 dark:border-green-800/50 pt-2">
                                  <div className="flex justify-between"><span>OEE:</span> <span className="font-bold text-slate-800 dark:text-slate-200">%{cell.payload.oe_value}</span></div>
                                  <div className="flex justify-between"><span>Üretim:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{cell.payload.total_production_units}</span></div>
                                  {cell.payload.machine_count && (
                                    <div className="flex justify-between relative group/machine">
                                      <span>Makine:</span>
                                      <span className="font-bold text-slate-800 dark:text-slate-200 border-b border-dashed border-green-400 cursor-help">{cell.payload.machine_count} Adet</span>
                                      {cell.payload.machines && cell.payload.machines.length > 0 && (
                                        <div className="absolute opacity-0 group-hover/machine:opacity-100 pointer-events-none transition-opacity bg-slate-800 text-white text-[10px] rounded p-2 z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-1 w-48 shadow-xl text-center">
                                          <strong>İstasyonlar:</strong><br/>
                                          {cell.payload.machines.join(", ")}
                                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              <button disabled={isSending} onClick={() => handleManualSend(cell.payload)} className="mt-3 w-full py-1.5 bg-green-600/90 text-white rounded text-[10px] font-bold hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50">
                                <Send size={10} className={`mr-1.5 ${isSending ? 'animate-pulse' : ''}`} /> {isSending ? 'Gönderiliyor...' : 'Tekrar Manuel Gönder'}
                              </button>
                            </div>
                          ) : cell.status === 'RETRY' ? (
                            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3 h-full relative group">
                              <div className="flex items-center justify-center mb-2">
                                <AlertTriangle size={16} className="text-orange-500 mr-1.5" />
                                <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase">Yeniden Denenecek</span>
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 mt-2 border-t border-orange-100 dark:border-orange-800/50 pt-2">
                                <div className="flex justify-between"><span>OEE:</span> <span className="font-bold text-slate-800 dark:text-slate-200">%{cell.payload.oe_value}</span></div>
                                <div className="flex justify-between"><span>Üretim:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{cell.payload.total_production_units}</span></div>
                                {cell.payload.machine_count && (
                                  <div className="flex justify-between relative group/machine">
                                    <span>Makine:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 border-b border-dashed border-slate-400 cursor-help">{cell.payload.machine_count} Adet</span>
                                    {cell.payload.machines && cell.payload.machines.length > 0 && (
                                      <div className="absolute opacity-0 group-hover/machine:opacity-100 pointer-events-none transition-opacity bg-slate-800 text-white text-[10px] rounded p-2 z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-1 w-48 shadow-xl text-center">
                                        <strong>İstasyonlar:</strong><br/>
                                        {cell.payload.machines.join(", ")}
                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {/* Hata Tooltip */}
                              {cell.errorMsg && (
                                <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-800 text-white text-[10px] rounded p-2 z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 shadow-xl text-center">
                                  <strong>Önceki Hata:</strong><br/>
                                  <span className="line-clamp-3">{cell.errorMsg}</span>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                </div>
                              )}
                              <button disabled={isSending} onClick={() => handleManualSend(cell.payload)} className="mt-3 w-full py-1.5 bg-orange-600/90 text-white rounded text-[10px] font-bold hover:bg-orange-700 transition-colors flex items-center justify-center disabled:opacity-50">
                                <Send size={10} className={`mr-1.5 ${isSending ? 'animate-pulse' : ''}`} /> {isSending ? 'Gönderiliyor...' : 'Manuel Gönder'}
                              </button>
                            </div>
                          ) : (
                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3 h-full">
                              <div className="flex items-center justify-center mb-2">
                                <Clock size={16} className="text-blue-500 mr-1.5" />
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase">Bekliyor</span>
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 mt-2 border-t border-blue-100 dark:border-blue-800/50 pt-2">
                                <div className="flex justify-between"><span>OEE:</span> <span className="font-bold text-slate-800 dark:text-slate-200">%{cell.payload.oe_value}</span></div>
                                <div className="flex justify-between"><span>Üretim:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{cell.payload.total_production_units}</span></div>
                                {cell.payload.machine_count && (
                                  <div className="flex justify-between relative group/machine">
                                    <span>Makine:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 border-b border-dashed border-blue-400 cursor-help">{cell.payload.machine_count} Adet</span>
                                    {cell.payload.machines && cell.payload.machines.length > 0 && (
                                      <div className="absolute opacity-0 group-hover/machine:opacity-100 pointer-events-none transition-opacity bg-slate-800 text-white text-[10px] rounded p-2 z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-1 w-48 shadow-xl text-center">
                                        <strong>İstasyonlar:</strong><br/>
                                        {cell.payload.machines.join(", ")}
                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <button disabled={isSending} onClick={() => handleManualSend(cell.payload)} className="mt-3 w-full py-1.5 bg-blue-600/90 text-white rounded text-[10px] font-bold hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50">
                                <Send size={10} className={`mr-1.5 ${isSending ? 'animate-pulse' : ''}`} /> {isSending ? 'Gönderiliyor...' : 'Manuel Gönder'}
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Tablosu */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
            <Server size={18} className="mr-2 text-indigo-500" /> API İletişim Logları (Gönderim Geçmişi)
          </h3>
          <div className="flex gap-4">
            <button onClick={handleClearLogs} className="text-sm text-red-600 hover:text-red-800 font-medium">Geçmişi Temizle</button>
          </div>
        </div>
        
        {logs.length === 0 ? (
          <div className="p-10 text-center text-slate-500">Henüz senkronizasyon kaydı bulunmuyor.</div>
        ) : (
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-900/80 sticky top-0 shadow-sm">
                <tr>
                  <th className="px-6 py-3">Zaman</th>
                  <th className="px-6 py-3">Kapsam (Tarih - Vardiya)</th>
                  <th className="px-6 py-3 text-center">HTTP Kodu</th>
                  <th className="px-6 py-3">Durum</th>
                  <th className="px-6 py-3">Hedef Sistem Yanıtı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-white">
                      {log.production_date} <span className="text-slate-400 px-1">|</span> Vardiya {log.shift}
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                         log.status_code === 200 ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 
                         log.status_code === 429 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30' : 
                         'bg-red-100 text-red-700 dark:bg-red-900/30'
                       }`}>
                         {log.status_code || 'ERR'}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                      {log.is_success ? (
                        <span className="flex items-center text-green-600 font-medium"><CheckCircle size={16} className="mr-1.5"/> Başarılı</span>
                      ) : (
                        <span className="flex items-center text-red-600 font-medium"><XCircle size={16} className="mr-1.5"/> Başarısız</span>
                      )}
                    </td>
                    <td className="px-6 py-4 max-w-lg">
                       {log.is_success ? (
                         <div className="flex flex-col gap-1">
                           <span className="text-xs text-green-600 font-medium">İşlem onaylandı.</span>
                           <span className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap break-words">{log.response_data}</span>
                         </div>
                       ) : (
                         <div className="flex flex-col gap-1">
                           <span className="text-xs text-red-600 font-medium whitespace-pre-wrap break-words">{log.response_data || 'Sunucuya ulaşılamadı veya Timeout.'}</span>
                           {log.status_code === 429 && <span className="text-[10px] text-orange-500 font-semibold">Rate Limit: Sistem otomatik bekletilip tekrar denendi.</span>}
                           {log.status_code === 413 && <span className="text-[10px] text-red-500 font-semibold">Yük çok büyük. Chunk stratejisi devreye girdi.</span>}
                         </div>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* API Ayarları Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center"><Settings className="mr-2" size={20} /> Hedef API Ayarları</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">API Key (X-Production-Key)</label>
                <input 
                  type="text" 
                  value={apiSettings.api_key} 
                  onChange={e => setApiSettings({...apiSettings, api_key: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500 mt-1">Hedef sisteme kimlik doğrulaması yapmak için kullanılır (.env dosyasına kaydedilir).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hedef API URL Endpoint'i</label>
                <input 
                  type="text" 
                  value={apiSettings.external_api_url} 
                  onChange={e => setApiSettings({...apiSettings, external_api_url: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500 mt-1">Verilerin POST edileceği tam URL adresi.</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-end gap-3">
              <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-sm">İptal</button>
              <button onClick={handleSaveSettings} className="px-4 py-2 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-sm flex items-center">
                <Save size={16} className="mr-2" /> Kaydet ve Uygula
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}