import { Route, Routes } from 'react-router';
import Nav from './components/Nav';
import { OfflineLine, UpdateLine } from './components/StatusLines';
import { useLaunchNavigation } from './lib/launch';
import Home from './pages/Home';
import Series from './pages/Series';
import ThisPc from './pages/ThisPc';

export default function App() {
  useLaunchNavigation();
  return (
    <div className="shell">
      <Nav />
      <main>
        <UpdateLine />
        <OfflineLine />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/series" element={<Series />} />
          <Route path="/pc" element={<ThisPc />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}
