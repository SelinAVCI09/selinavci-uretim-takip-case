import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './pages/MainLayout';
import Import from './pages/Import';
import Dashboard from './pages/Dashboard';
import Filter from './pages/Filter';
import Validation from './pages/Validation';
import ApiSync from './pages/ApiSync';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/import" replace />} />
          <Route path="import" element={<Import />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="filter" element={<Filter />} />
          <Route path="validation" element={<Validation />} />
          <Route path="sync" element={<ApiSync />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default App;