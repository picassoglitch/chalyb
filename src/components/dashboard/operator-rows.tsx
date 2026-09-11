'use client';

import { useState } from 'react';
import { toggleFavoriteClient } from '@/lib/data/favorites-client';
import {
  type Engine,
  type EngineStateCode,
  CATS,
  ENV_LABEL,
  STATE_LABEL,
} from '@/lib/data/types';
import { useDashboard } from '@/lib/dashboard/store';

const COLOR_VAR: Record<EngineStateCode, string> = {
  g: '--cc-green',
  c: '--cc-cyan',
  p: '--cc-purple',
  a: '--cc-amber',
  r: '--cc-red',
  o: '--cc-txt-4',
};

function HealthBars({ bot }: { bot: Engine }) {
  const n = 10;
  const on = Math.round((bot.health / 100) * n);
  const cls = bot.stateCode === 'g' ? '' : bot.stateCode;
  return (
    <div className="cc-hbars">
      {Array.from({ length: n }).map((_, i) => {
        const ht = 6 + i * 1.1;
        const active = i < on;
        return (
          <i
            key={i}
            className={active ? `cc-hb-act ${cls}` : ''}
            style={{ height: `${ht}px` }}
          />
        );
      })}
    </div>
  );
}

function OperatorRow({ bot }: { bot: Engine }) {
  const openDrawer = useDashboard((s) => s.openDrawer);
  const toggleFav = useDashboard((s) => s.toggleFavorite);
  const showToast = useDashboard((s) => s.showToast);

  function handleFav(e: React.MouseEvent) {
    e.stopPropagation();
    const wasFavorite = bot.favorite;
    toggleFav(bot.id);
    showToast(wasFavorite ? `${bot.name} desfijado` : `<b>${bot.name}</b> fijado`);
    void toggleFavoriteClient(bot.id, wasFavorite);
  }

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    openDrawer(bot.id);
  }

  const pulse = bot.stateCode !== 'o';
  const envText =
    bot.stateCode === 'o'
      ? 'Offline · —'
      : `${ENV_LABEL[bot.env]} · ${bot.region}${bot.node !== '—' ? ' · ' + bot.node : ''}`;

  return (
    <div className="cc-row" role="button" tabIndex={0} onClick={() => openDrawer(bot.id)}>
      <div className="cc-stat">
        <span className={`cc-led ${bot.stateCode}${pulse ? ' pulse' : ''}`} />
      </div>
      <div className="cc-r-bot">
        <div className="cc-r-ic">{bot.icon}</div>
        <div className="cc-r-nm">
          <div className="cc-r-nn">{bot.name}</div>
          <div className="cc-r-env">
            {bot.stateCode === 'o' ? (
              envText
            ) : (
              <>
                <b>{ENV_LABEL[bot.env]}</b> · {bot.region}
                {bot.node !== '—' && ' · ' + bot.node}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="cc-r-type">{bot.type}</div>
      <div className="cc-r-health">
        <HealthBars bot={bot} />
        <span className="cc-ht">
          {bot.stateCode === 'o' ? '—' : `${bot.health}% · ${bot.latencyMs || '—'}ms`}
        </span>
      </div>
      <div className={`cc-r-rev ${bot.revenueCents > 0 ? 'pos' : 'zero'}`}>
        {bot.revenueCents > 0 ? '$' + Math.round(bot.revenueCents / 100).toLocaleString() : '—'}
      </div>
      <div className="cc-r-act">
        {bot.stateCode === 'o' ? 'hace 3d' : bot.stateCode === 'r' ? 'falló' : 'ahora'}
      </div>
      <div className="cc-r-go">
        <button type="button" className="cc-mini" title="Fijar" onClick={handleFav}>
          {bot.favorite ? '★' : '☆'}
        </button>
        <button type="button" className="cc-mini go" title="Abrir" onClick={handleOpen}>
          ↗
        </button>
      </div>
    </div>
  );
}

function CategorySection({ catId, bots }: { catId: Engine['category']; bots: Engine[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const cat = CATS.find((c) => c.id === catId)!;
  const live = bots.filter((b) => b.stateCode !== 'o' && b.stateCode !== 'r').length;
  const rev = bots.reduce((a, b) => a + b.revenueCents, 0);
  return (
    <div className="cc-cat">
      <button
        type="button"
        className={`cc-cat-h${collapsed ? ' col' : ''}`}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="cc-tw">▼</span>
        <h3>{cat.label}</h3>
        <span className="cc-cat-c">{bots.length}</span>
        <span className="cc-cat-bar" />
        <span className="cc-cat-agg">
          <span>
            <b>{live}</b> activos
          </span>
          <span>
            $<b>{Math.round(rev / 100).toLocaleString()}</b>
          </span>
        </span>
      </button>
      {!collapsed && (
        <div className="cc-rows">
          <div className="cc-rh">
            <div />
            <div>Sistema</div>
            <div className="cc-h-type">Tipo</div>
            <div>Salud</div>
            <div className="cc-h-rev">Ingresos</div>
            <div className="cc-h-act">Última actividad</div>
            <div />
          </div>
          {bots.map((b) => (
            <OperatorRow key={b.id} bot={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturedStrip({ bots }: { bots: Engine[] }) {
  const openDrawer = useDashboard((s) => s.openDrawer);
  if (!bots.length) return null;
  return (
    <div className="cc-feat-wrap">
      <div className="cc-feat-h">Tus favoritos</div>
      <div className="cc-feat">
        {bots.map((b) => {
          const [lbl] = [STATE_LABEL[b.stateCode]];
          return (
            <button
              key={b.id}
              type="button"
              className="cc-fcard"
              onClick={() => openDrawer(b.id)}
            >
              <div className="cc-ft">
                <div className="cc-fi">{b.icon}</div>
                <span
                  className="cc-fbadge"
                  style={{
                    color: `var(${COLOR_VAR[b.stateCode]})`,
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid var(--cc-line-2)',
                  }}
                >
                  {lbl}
                </span>
              </div>
              <h4>{b.name}</h4>
              <div className="cc-fd">{b.description}</div>
              <div className="cc-fm">
                <span>
                  Salud <b>{b.health}%</b>
                </span>
                <span>
                  Ingresos{' '}
                  <b>
                    {b.revenueCents
                      ? '$' + Math.round(b.revenueCents / 100).toLocaleString()
                      : '—'}
                  </b>
                </span>
                <span>
                  <b>{ENV_LABEL[b.env]}</b>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OperatorSurface() {
  const bots = useDashboard((s) => s.engines);
  const query = useDashboard((s) => s.query);
  const activeCats = useDashboard((s) => s.activeCats);
  const viewMode = useDashboard((s) => s.viewMode);

  const filtered = bots.filter((b) => {
    if (viewMode === 'fav' && !b.favorite) return false;
    if (activeCats.size && !activeCats.has(b.category)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !b.name.toLowerCase().includes(q) &&
        !b.type.toLowerCase().includes(q) &&
        !ENV_LABEL[b.env].toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const cats = activeCats.size ? CATS.filter((c) => activeCats.has(c.id)) : CATS;
  const featured = bots.filter(
    (b) => b.featured && (!activeCats.size || activeCats.has(b.category)) && (viewMode !== 'fav' || b.favorite),
  );

  return (
    <>
      {!query && <FeaturedStrip bots={featured} />}
      {cats.map((c) => {
        const bs = filtered.filter((b) => b.category === c.id);
        if (!bs.length) return null;
        return <CategorySection key={c.id} catId={c.id} bots={bs} />;
      })}
      {!filtered.length && (
        <div className="cc-empty-state">▸ Ningún sistema coincide con tu búsqueda.</div>
      )}
    </>
  );
}

export function Toolbar() {
  const bots = useDashboard((s) => s.engines);
  const query = useDashboard((s) => s.query);
  const activeCats = useDashboard((s) => s.activeCats);
  const viewMode = useDashboard((s) => s.viewMode);
  const setQuery = useDashboard((s) => s.setQuery);
  const toggleCat = useDashboard((s) => s.toggleCat);
  const setViewMode = useDashboard((s) => s.setViewMode);

  return (
    <div className="cc-tbar">
      <div className="cc-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca por nombre, tipo o entorno…"
        />
      </div>
      <div className="cc-chips">
        {CATS.map((c) => {
          const n = bots.filter((b) => b.category === c.id).length;
          const on = activeCats.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={`cc-chip${on ? ' on' : ''}`}
              onClick={() => toggleCat(c.id)}
            >
              {c.label}
              <span className="cc-chip-n">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="cc-seg">
        <button
          type="button"
          className={viewMode === 'rows' ? 'on' : ''}
          onClick={() => setViewMode('rows')}
        >
          Filas
        </button>
        <button
          type="button"
          className={viewMode === 'fav' ? 'on' : ''}
          onClick={() => setViewMode('fav')}
        >
          ★ Favoritos
        </button>
      </div>
    </div>
  );
}
