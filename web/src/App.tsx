import { FeatureInfoPanel } from './components/FeatureInfoPanel';
import { LegendPanel } from './components/LegendPanel';
import { MapView } from './components/MapView';

export function App() {
  return (
    <div className="app">
      <MapView />
      <LegendPanel />
      <FeatureInfoPanel />
    </div>
  );
}
