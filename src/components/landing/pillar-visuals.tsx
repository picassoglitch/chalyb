import { Sparkline, Waveform } from './mock-bits';

// One static mock per value pillar. All three are decorative (aria-hidden);
// the adjacent copy carries the meaning.

export interface ClipVisualData {
  live: string;
  meta: string;
  frame: string;
  rows: Array<{ name: string; status: string }>;
}

export interface StreamVisualData {
  scenes: string[];
  active: string;
  toggles: Array<{ label: string; on: boolean }>;
}

export interface SignalVisualData {
  pair: string;
  signal: string;
  mode: string;
  stat1: string;
  stat2: string;
  stat3: string;
}

export function ClipVisual({ v }: { v: ClipVisualData }) {
  return (
    <div className="lp-visual" aria-hidden="true">
      <div className="lp-vis-head">
        <span className="lp-pill">
          <i />
          {v.live}
        </span>
        <span className="lp-vis-meta">{v.meta}</span>
      </div>
      <div className="lp-wave">
        <Waveform />
      </div>
      <div className="lp-vis-grid">
        <div className="lp-clipframe">
          <span>{v.frame}</span>
        </div>
        <div className="lp-rows">
          {v.rows.map((row, i) => (
            <div key={row.name} className="lp-row">
              <span>{row.name}</span>
              <span className={i === 0 ? 'ok' : undefined}>{row.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StreamVisual({ v }: { v: StreamVisualData }) {
  return (
    <div className="lp-visual" aria-hidden="true">
      <div className="lp-scenes">
        {v.scenes.map((scene) => {
          const on = scene === v.active;
          return (
            <div key={scene} className={`lp-scene${on ? ' on' : ''}`}>
              <span>{scene}</span>
              {on && <i />}
            </div>
          );
        })}
      </div>
      <div className="lp-toggles">
        {v.toggles.map((toggle) => (
          <div key={toggle.label} className="lp-toggle">
            <span>{toggle.label}</span>
            <span className={`lp-switch${toggle.on ? ' on' : ''}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SignalVisual({ v }: { v: SignalVisualData }) {
  return (
    <div className="lp-visual" aria-hidden="true">
      <div className="lp-vis-head">
        <strong className="lp-vis-pair">{v.pair}</strong>
        <span className="lp-pill lp-pill-muted">{v.mode}</span>
      </div>
      <p className="lp-vis-signal">{v.signal}</p>
      <div className="lp-spark">
        <Sparkline />
      </div>
      <div className="lp-stats">
        <div className="lp-stat">
          <small>{v.stat1}</small>
          <b className="up">+12.4%</b>
        </div>
        <div className="lp-stat">
          <small>{v.stat2}</small>
          <b>218</b>
        </div>
        <div className="lp-stat">
          <small>{v.stat3}</small>
          <b className="up">61%</b>
        </div>
      </div>
    </div>
  );
}
