import { Send, Server } from 'lucide-react';

export default function ApiSync() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <Server className="mr-3 text-blue-500" /> Hedef API Senkronizasyonu
        </h1>
        <p className="text-slate-500 mt-1">
          Sadece validasyondan geçmiş (hatasız) temiz veriler merkez sisteme aktarılır.
        </p>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="text-center py-8">
          <Send size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Gönderime Hazır Temiz Kayıtlar</h3>
          <p className="text-slate-500 mb-6">Şu anda sisteminizde bekleyen validasyon onaylı kayıtları hedef sisteme toplu gönderebilirsiniz.</p>
          
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center mx-auto shadow-md">
            <Send size={18} className="mr-2" />
            Hedef Sisteme Senkronize Et
          </button>
        </div>
      </div>
    </div>
  );
}