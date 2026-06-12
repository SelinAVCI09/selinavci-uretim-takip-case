import { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function Validation() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (!errString) return ['Bilinmeyen Hata'];
    try {
      const parsed = JSON.parse(errString);
      return Array.isArray(parsed) ? parsed : [errString];
    } catch {
      return [errString];
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
          <AlertTriangle className="mr-3 text-orange-500" /> Veri Validasyon ve Hata Raporları
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          MES sisteminden gelen hatalı ve şüpheli kayıtları buradan inceleyebilir, hata nedenlerini görebilirsiniz.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Kayıtlar yükleniyor...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <CheckCircle size={48} className="text-green-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-white">Tebrikler! Şüpheli kayıt yok.</h3>
            <p className="text-slate-500 dark:text-slate-400">Yüklenen tüm veriler kalite testinden başarıyla geçti.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
              <thead className="text-xs text-slate-700 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">Kayıt ID</th>
                  <th className="px-6 py-4">İş Emri / Stok</th>
                  <th className="px-6 py-4">OEE / Fire</th>
                  <th className="px-6 py-4">Tespit Edilen Hatalar</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.record_id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{record.record_id}</td>
                    <td className="px-6 py-4">
                      <div className="dark:text-slate-200">{record.work_order_no || 'Bilinmiyor'}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{record.stock_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="dark:text-slate-200">OEE: %{record.oee}</span> <br /> 
                      <span className="dark:text-slate-400">Fire: {record.scrap_qty} ad</span>
                    </td>
                    <td className="px-6 py-4 text-red-600 dark:text-red-400 font-medium">
                      <ul className="list-disc pl-4 space-y-1">
                        {parseErrors(record.validation_errors).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
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