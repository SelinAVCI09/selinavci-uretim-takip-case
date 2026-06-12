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
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <AlertTriangle className="mr-3 text-orange-500" /> Veri Validasyon ve Hata Raporları
        </h1>
        <p className="text-slate-500 mt-1">
          MES sisteminden gelen hatalı ve şüpheli kayıtları buradan inceleyebilir, hata nedenlerini görebilirsiniz.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Kayıtlar yükleniyor...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <CheckCircle size={48} className="text-green-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">Tebrikler! Şüpheli kayıt yok.</h3>
            <p className="text-slate-500">Yüklenen tüm veriler kalite testinden başarıyla geçti.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Kayıt ID</th>
                  <th className="px-6 py-4">İş Emri / Stok</th>
                  <th className="px-6 py-4">OEE / Fire</th>
                  <th className="px-6 py-4">Tespit Edilen Hatalar</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.record_id} className="bg-white border-b hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{record.record_id}</td>
                    <td className="px-6 py-4">
                      <div>{record.work_order_no || 'Bilinmiyor'}</div>
                      <div className="text-xs text-slate-400">{record.stock_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      OEE: %{record.oee} <br /> Fire: {record.scrap_qty} ad
                    </td>
                    <td className="px-6 py-4 text-red-600 font-medium">
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