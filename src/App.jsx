import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import DanceGame from './pages/DanceGame';
import ShooterGame from './pages/ShooterGame';
import AvatarTest from './pages/AvatarTest';
import ColorSortGame from './pages/ColorSortGame';
import FruitNinjaGame from './pages/FruitNinjaGame';
import LightsaberGame from './pages/LightsaberGame';
import RunnerGame from './pages/RunnerGame';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dance" element={<DanceGame />} />
        <Route path="/shooter" element={<ShooterGame />} />
        <Route path="/avatar-test" element={<AvatarTest />} />
        <Route path="/color-sort" element={<ColorSortGame />} />
        <Route path="/fruit-ninja" element={<FruitNinjaGame />} />
        <Route path="/lightsaber" element={<LightsaberGame />} />
        <Route path="/runner" element={<RunnerGame />} />
      </Routes>
    </Router>
  );
}

export default App;
