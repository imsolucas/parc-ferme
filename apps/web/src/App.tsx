import { Route, Routes } from 'react-router-dom';
import { Shell } from './components/ui/Shell';
import { HomeScreen } from './screens/HomeScreen';
import { JoinScreen } from './screens/JoinScreen';
import { LeagueScreen } from './screens/LeagueScreen';
import { LoginScreen } from './screens/LoginScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';
import { RoundScreen } from './screens/RoundScreen';

// Screens own data loading and layout; everything visual lives in components/ui and components/game.
export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/join/:token" element={<JoinScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/league/:leagueId" element={<LeagueScreen />} />
        <Route path="/league/:leagueId/round/:roundId" element={<RoundScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </Shell>
  );
}
