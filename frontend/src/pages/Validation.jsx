import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle, Edit2, Trash2, Save, X, History } from 'lucide-react';

export default function Validation() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [expandedHistory, setExpandedHistory] = useState({});

  useEffect(() => {
    fetchSuspiciousRecords();
  }, []);

  const fetchSuspiciousRecords = async () => {
    try {
      // is_valid=false olan yani sadece şüpheli kayıtları çekiyoruz
      const response = await axios.get('http://localhost:8000/api/v1/records?is_valid=false');
      setRecords(response.data);
    } catch (error) {
      console.error('Kayıtlar çekilirken hata oluştu', error);
    } finally {
      setLoading(false);
    }
  };

  // Veritabanında eski formattaki hatalar varsa sayfanın çökmesini (beyaz ekran) engeller
  const parseErrors = (errString) => {
    if (!errString || errString === "null") return [];
    try {
      const parsed = JSON.parse(errString);
      return Array.isArray(parsed) ? parsed : [{ message: errString, error_type: 'Bilinmeyen Hata', action: 'uyar', field: 'Bilinmiyor' }];
    } catch {
      return [{ message: errString, error_type: 'Bilinmeyen Hata', action: 'uyar', field: 'Bilinmiyor' }];
    }
  };

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
        setRecords(records.filter(r => r.record_id !== recordId));
      } else {
        setRecords(records.map(r => r.record_id === recordId ? { 
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
      setRecords(records.filter(r => r.record_id !== recordId));
    } catch (error) {
      console.error('Kayıt reddedilirken hata oluştu', error);
      alert('Kayıt silinemedi.');
    }
  };

  const getActionColor = (action) => {
    switch(action) {
      case 'reddet': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'düzelt': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'uyar': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
          <AlertTriangle className="mr-3 text-orange-500" /> Veri Validasyonu ve Kalite Raporu
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Sistem kalite kurallarına takılan şüpheli veya hatalı kayıtları buradan inceleyin. İlgili kayıtları düzeltebilir veya silebilirsiniz.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Kayıtlar yükleniyor...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <CheckCircle size={48} className="text-green-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-white">Tebrikler! Şüpheli kayıt yok.</h3>
            <p className="text-slate-500 dark:text-slate-400">Yüklenen tüm veriler kalite testinden başarıyla geçti veya hepsi düzeltildi.</p>
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
                {records.map((record) => (
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
                        
                        {record.audit_trail && record.audit_trail !== "null" && JSON.parse(record.audit_trail).length > 0 && (
                          <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-2">
                            <button onClick={() => toggleHistory(record.record_id)} className="flex items-center text-[10px] text-indigo-500 hover:text-indigo-600 font-medium">
                              <History size={12} className="mr-1" /> Geçmiş ({JSON.parse(record.audit_trail).length})
                            </button>
                            {expandedHistory[record.record_id] && (
                              <div className="mt-2 space-y-1 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded text-[10px]">
                                {JSON.parse(record.audit_trail).map((log, idx) => (
                                  <div key={idx} className="border-b border-indigo-100 dark:border-indigo-800/30 pb-1 last:border-0 last:pb-0">
                                    <span className="text-slate-500 block mb-0.5">{new Date(log.timestamp).toLocaleString()}</span>
                                    {log.changes.map((c, i) => (
                                      <div key={i} className="text-indigo-700 dark:text-indigo-300">
                                        <span className="font-semibold">{c.field}:</span> {c.old} &rarr; {c.new}
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
                            const isComplex = typeof err === 'object';
                            const msg = isComplex ? err.message : err;
                            const type = isComplex ? err.error_type : 'Bilinmeyen Hata';
                            const action = isComplex ? err.action : 'uyar';
                            const reason = isComplex ? err.reason : null;
                            const field = isComplex ? err.field : 'N/A';
                            
                            return (
                              <div key={i} className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-3 rounded-lg text-xs flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-red-700 dark:text-red-400">{type}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getActionColor(action)}`}>
                                    Öneri: {action}
                                  </span>
                                </div>
                                <span className="text-slate-700 dark:text-slate-300 mt-1">{msg}</span>
                                {reason && (
                                  <span className="text-slate-500 dark:text-slate-400 mt-1 italic text-[11px] block">💡 {reason}</span>
                                )}
                                <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px] mt-1">İlgili Alan(lar): {field}</span>
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
                                <input type="number" value={editFormData.shift || ''} onChange={(e) => handleInputChange(e, 'shift')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Toplam Üretim</label>
                                <input type="number" value={editFormData.total_produced || ''} onChange={(e) => handleInputChange(e, 'total_produced')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Fire (Scrap)</label>
                                <input type="number" value={editFormData.scrap_qty || ''} onChange={(e) => handleInputChange(e, 'scrap_qty')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">OEE (%)</label>
                                <input type="number" step="0.1" value={editFormData.oee || ''} onChange={(e) => handleInputChange(e, 'oee')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Toplam Duruş (dk)</label>
                                <input type="number" step="0.1" value={editFormData.down_time || ''} onChange={(e) => handleInputChange(e, 'down_time')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Planlı Duruş (dk)</label>
                                <input type="number" step="0.1" value={editFormData.planned_down_time || ''} onChange={(e) => handleInputChange(e, 'planned_down_time')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Plansız Duruş (dk)</label>
                                <input type="number" step="0.1" value={editFormData.unplanned_down_time || ''} onChange={(e) => handleInputChange(e, 'unplanned_down_time')} className="w-full text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md p-2 border" />
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
    </div>
  );
}