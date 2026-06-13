import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle, AlertCircle, FileText, X, Trash2, Database } from 'lucide-react';

export default function Import() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [filePreview, setFilePreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const [dbStats, setDbStats] = useState({ total: 0, valid: 0, warning: 0, error: 0 });

  const fetchStats = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/stats');
      setDbStats(res.data);
      
      // Eğer veritabanı tamamen boşsa ama tarayıcı hafızasında eski rapor kalmışsa hafızayı temizle
      if (res.data.total === 0) {
        localStorage.removeItem('lastUploadResult');
        localStorage.removeItem('lastFileName');
        setResult(null);
        setFileName("");
      }
    } catch (err) { console.error("İstatistikler alınamadı", err); }
  };

  useEffect(() => {
    fetchStats();
    const savedResult = localStorage.getItem('lastUploadResult');
    const savedFileName = localStorage.getItem('lastFileName');
    if (savedResult && savedFileName) {
      try {
        setResult(JSON.parse(savedResult));
        setFileName(savedFileName);
      } catch (err) {
        localStorage.removeItem('lastUploadResult');
        localStorage.removeItem('lastFileName');
      }
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setResult(null);
      setError(null);
      setUploadProgress(0);

      // Yükleme öncesi ilk 5-6 satırın okunup önizlenmesi
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n').slice(0, 6).filter(line => line.trim() !== '');
        const parsedLines = lines.map(line => line.split(','));
        setFilePreview(parsedLines);
      };
      reader.readAsText(selectedFile.slice(0, 4096)); // Sadece ilk 4KB okunur
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileName("");
    setFilePreview([]);
    setResult(null);
    setError(null);
    setUploadProgress(0);
    localStorage.removeItem('lastUploadResult');
    localStorage.removeItem('lastFileName');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearDatabase = async () => {
    if (!window.confirm("Veritabanındaki tüm kayıtlar kalıcı olarak silinecek. Onaylıyor musunuz?")) return;
    try {
      await axios.delete('http://localhost:8000/api/v1/records');
      await fetchStats();
      handleRemoveFile();
    } catch (err) { console.error("Veritabanı temizlenemedi", err); }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8000/api/v1/upload-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      setResult(response.data);
      localStorage.setItem('lastUploadResult', JSON.stringify(response.data));
      localStorage.setItem('lastFileName', fileName);
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.detail || "Dosya yüklenirken bir hata oluştu.");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 2000); // Progress bar'ı 2sn sonra gizle
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Üretim Raporu Yükle</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">MES sisteminden aldığınız günlük .csv raporunu buraya yükleyin.</p>
      </div>

      {/* Veritabanı Durum Bilgisi */}
      {dbStats.total > 0 && !result && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center mb-4 md:mb-0">
            <Database className="text-blue-500 mr-4" size={32} />
            <div>
              <h3 className="font-bold text-blue-800 dark:text-blue-300">Sistemde Yüklü Veri Bulunuyor</h3>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Şu anda veritabanında <strong>{dbStats.total}</strong> kayıt var ({dbStats.valid} geçerli, {dbStats.warning} uyarı, {dbStats.error} kesin hatalı).
              </p>
            </div>
          </div>
          <button 
            onClick={handleClearDatabase}
            className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors font-medium text-sm shadow-sm"
          >
            <Trash2 size={16} className="mr-2" /> Veritabanını Temizle
          </button>
        </div>
      )}

      {/* Dosya Yükleme Kartı */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-all duration-300">
        {!file && !fileName ? (
          <div 
            className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-12 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={56} className="text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">CSV Dosyasını Seçin veya Sürükleyin</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Sadece .csv uzantılı dosyalar desteklenmektedir.</p>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Yükleme Öncesi Tablo Önizlemesi */}
            {filePreview.length > 1 && !result && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-900/80 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dosya Önizlemesi (İlk 5 Satır)</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <tr>{filePreview[0].map((h, i) => <th key={i} className="px-4 py-2 truncate max-w-[100px]">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {filePreview.slice(1).map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">{row.map((cell, j) => <td key={j} className="px-4 py-2 truncate max-w-[100px] text-slate-600 dark:text-slate-300">{cell}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-center">
                  <FileText className="text-slate-500 mr-3" size={28} />
                  <span className="font-medium text-slate-800 dark:text-slate-200">{fileName}</span>
                  {file && <span className="text-sm text-slate-500 dark:text-slate-400 ml-3">({(file.size / 1024).toFixed(2)} KB)</span>}
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={handleRemoveFile} className="p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-500 rounded-full transition-colors" title="Dosyayı Sil">
                    <X size={20} />
                  </button>
                  {!result && file && (
                    <button 
                      onClick={handleUpload}
                      disabled={uploading}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium shadow-sm min-w-[140px]"
                    >
                      {uploading ? `Yükleniyor... %${uploadProgress}` : 'Sisteme Yükle'}
                    </button>
                  )}
                </div>
              </div>

              {uploading && (
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-lg flex items-center text-red-700 dark:text-red-400">
          <AlertCircle className="mr-3" /> {error}
        </div>
      )}

      {result && result.summary && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl p-6">
          <h3 className="text-lg font-bold text-green-800 dark:text-green-400 flex items-center mb-6">
            <CheckCircle className="mr-2" /> CSV Rapor Yüklemesi Tamamlandı
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-green-100 dark:border-green-800/30"><div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Toplam Satır</div><div className="text-xl font-bold text-slate-800 dark:text-slate-200">{result.summary.total_rows}</div></div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-green-100 dark:border-green-800/30"><div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Geçerli Kayıt</div><div className="text-xl font-bold text-green-600 dark:text-green-400">{result.summary.valid}</div></div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-orange-100 dark:border-orange-800/30"><div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Uyarı (Şüpheli)</div><div className="text-xl font-bold text-orange-500 dark:text-orange-400">{result.summary.warning}</div></div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-red-100 dark:border-red-800/30"><div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Kesin Hatalı</div><div className="text-xl font-bold text-red-600 dark:text-red-400">{result.summary.error}</div></div>
          </div>

          {result.summary.error_breakdown && Object.keys(result.summary.error_breakdown).length > 0 && (
            <div className="mt-6 bg-orange-50 dark:bg-orange-900/30 p-5 rounded-lg border border-orange-200 dark:border-orange-800/50">
              <h4 className="font-semibold text-orange-800 dark:text-orange-400 mb-3 flex items-center">
                <AlertCircle size={18} className="mr-2" />
                Tespit Edilen Kalite Sorunlarının Dökümü
              </h4>
              <ul className="list-disc pl-5 text-sm text-orange-700 dark:text-orange-300 space-y-1">
                {Object.entries(result.summary.error_breakdown).map(([err, count]) => (
                  <li key={err}><strong>{count} adet</strong> kayıt: {err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}