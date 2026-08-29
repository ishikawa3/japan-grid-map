import { useEffect } from 'react';
import { AboutPanel } from './components/AboutPanel';
import { FeatureInfoPanel } from './components/FeatureInfoPanel';
import { LegendPanel } from './components/LegendPanel';
import { MapView } from './components/MapView';
import { PwaStatus } from './components/PwaStatus';
import { SearchPanel } from './components/SearchPanel';
import { registerWebMcpTools } from './lib/webmcp';

export function App() {
  // AIエージェント向けにページの操作をツールとして公開する（対応ブラウザのみ）
  useEffect(() => registerWebMcpTools(), []);

  return (
    <div className="app">
      <MapView />
      <LegendPanel />
      <SearchPanel />
      <FeatureInfoPanel />
      <AboutPanel />
      <PwaStatus />
    </div>
  );
}
