import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Send, Clock, CheckCircle, AlertTriangle, RefreshCw, Server, XCircle, Database, Calendar, AlertCircle, Info } from 'lucide-react';

export default function Sync() {
  const [preview, setPreview] = useState(null);
  const [syncState, setSyncState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Gün x Vardiya Matrisini Oluşturma
  const matrixData = useMemo(() => {
    if (!preview || !logs) return [];
    const matrix = {};

    // 1. Önce başarılı gönderimleri matrise ekle (Idempotent - Gönderilmişler)
    logs.filter(l => l.is_success).forEach(log => {
      if (!matrix[log.production_date]) matrix[log.production_date] = { 1: null, 2: null, 3: null };
      matrix[log.production_date][log.shift] = { status: 'SUCCESS', statusCode: log.status_code };
    });

    // 2. Bekleyenleri (Yeni veya Hata almış Retry kayıtları) matrise ekle
    (preview.pending_payloads || []).forEach(payload => {
      if (!matrix[payload.production_date]) matrix[payload.production_date] = { 1: null, 2: null, 3: null };
      
      // Bu kayıt loglarda daha önce hata almış mı kontrol et
      const previousFail = logs.find(l => !l.is_success && l.production_date === payload.production_date && l.shift === payload.shift);
      
      matrix[payload.production_date][payload.shift] = {
        status: previousFail ? 'RETRY' : 'PENDING',
        errorMsg: previousFail ? previousFail.response_data : null,
        payload: payload
      };
    });

    // Tarihe göre azalan (yeniden eskiye) sırala
    return Object.keys(matrix)
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
      
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
          <Server className="mr-3 text-indigo-500" /> Hedef Sistem API Senkronizasyonu
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Validasyon testini başarıyla geçen kayıtları gruplayarak (Tarih ve Vardiya bazında) dış API'ye aktarın.
        </p>
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
                    ? <span><strong>{stats.pending} adet</strong> vardiya grubu (yeni veya hatalı) gönderilmeyi bekliyor.</span>
                    : <span>Tüm veriler güncel. Gönderilecek yeni kayıt bulunamadı.</span>
                ) : (
                  <span>Hedef sistem API'si ile haberleşiliyor. Arkaplanda işleniyor...</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex-shrink-0 w-full md:w-auto">
            {!syncState?.is_syncing ? (
              <button 
                onClick={handleStartSync} 
                disabled={stats.pending === 0}
                className="w-full md:w-auto flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-md"
              >
                <RefreshCw size={18} className="mr-2" /> Senkronizasyonu Başlat
              </button>
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hedef sisteme gidecek veya daha önce gitmiş verilerin vardiya bazlı kırılımı.</p>
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
            <p>Sistemde henüz valide edilmiş veya senkronize edilmiş hiçbir vardiya verisi bulunmuyor.</p>
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
                      return (
                        <td key={shiftNum} className="px-3 py-3 align-top">
                          {!cell ? (
                            <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                              -
                            </div>
                          ) : cell.status === 'SUCCESS' ? (
                            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3 h-full flex flex-col items-center justify-center text-center">
                              <CheckCircle size={20} className="text-green-500 mb-1" />
                              <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">Aktarıldı</span>
                            </div>
                          ) : cell.status === 'RETRY' ? (
                            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3 h-full relative group">
                              <div className="flex items-center justify-center mb-2">
                                <AlertTriangle size={16} className="text-orange-500 mr-1.5" />
                                <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase">Yeniden Denenecek</span>
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 mt-2 border-t border-orange-100 dark:border-orange-800/50 pt-2">
                                <div className="flex justify-between"><span>OEE:</span> <span className="font-bold">%{cell.payload.oe_value}</span></div>
                                <div className="flex justify-between"><span>Üretim:</span> <span className="font-bold">{cell.payload.total_production_units}</span></div>
                              </div>
                              {/* Hata Tooltip */}
                              {cell.errorMsg && (
                                <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-800 text-white text-[10px] rounded p-2 z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 shadow-xl text-center">
                                  <strong>Önceki Hata:</strong><br/>
                                  <span className="line-clamp-3">{cell.errorMsg}</span>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                </div>
                              )}
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
                                <div className="flex justify-between"><span>Makine:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{cell.payload.machine_count} Adet</span></div>
                              </div>
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
          <button onClick={fetchDashboard} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Güncelle</button>
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
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
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
                    <td className="px-6 py-4 max-w-xs">
                       {log.is_success ? (
                         <span className="text-xs text-slate-500 truncate block">İşlem onaylandı.</span>
                       ) : (
                         <div className="flex flex-col gap-1">
                           <span className="text-xs text-red-600 font-medium line-clamp-2" title={log.response_data}>{log.response_data || 'Sunucuya ulaşılamadı veya Timeout.'}</span>
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
    </div>
  );
}