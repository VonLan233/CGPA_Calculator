import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { GradeEntryPage } from './pages/GradeEntryPage';
import { RetakePlanningPage } from './pages/RetakePlanningPage';
import { FuturePlanningPage } from './pages/FuturePlanningPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<GradeEntryPage />} />
          <Route path="retake" element={<RetakePlanningPage />} />
          <Route path="future" element={<FuturePlanningPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
