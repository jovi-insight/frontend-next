"use client";

import type { Fps, ModoFlash, Resolucao } from "@/lib/use-camera";

export type Ajustes = {
  grade: boolean;
  realce: boolean;
  hdr: boolean;
  /** 0 = sem temporizador. */
  timer: 0 | 3 | 10;
  proporcao: "16:9" | "4:3" | "1:1";
};

export const AJUSTES_PADRAO: Ajustes = {
  grade: false,
  realce: false,
  hdr: true,
  timer: 0,
  proporcao: "16:9",
};

export type Gaveta = "ajustes" | "flash" | "qualidade" | null;

/** Gaveta de ajustes: os quadradinhos do topo da câmera. */
export function GavetaAjustes({
  ajustes,
  onMudar,
  onFocar,
}: {
  ajustes: Ajustes;
  onMudar: (a: Ajustes) => void;
  onFocar: () => void;
}) {
  const proximoTimer = { 0: 3, 3: 10, 10: 0 } as const;
  const proximaProporcao = { "16:9": "4:3", "4:3": "1:1", "1:1": "16:9" } as const;

  return (
    <div className="settings-drawer">
      <div className="settings-grid">
        <button
          className={`settings-square${ajustes.hdr ? " active" : ""}`}
          onClick={() => onMudar({ ...ajustes, hdr: !ajustes.hdr })}
          aria-pressed={ajustes.hdr}
        >
          <span className="material-symbols-outlined">hdr_on</span>
          <span>HDR</span>
        </button>

        <button
          className={`settings-square${ajustes.grade ? " active" : ""}`}
          onClick={() => onMudar({ ...ajustes, grade: !ajustes.grade })}
          aria-pressed={ajustes.grade}
        >
          <span className="material-symbols-outlined">grid_on</span>
          <span>GRADE</span>
        </button>

        <button
          className={`settings-square${ajustes.timer ? " active" : ""}`}
          onClick={() => onMudar({ ...ajustes, timer: proximoTimer[ajustes.timer] })}
          aria-pressed={ajustes.timer > 0}
        >
          <span className="material-symbols-outlined">timer</span>
          <span>{ajustes.timer ? `${ajustes.timer}S` : "TEMPO"}</span>
        </button>

        <button
          className={`settings-square${ajustes.proporcao !== "16:9" ? " active" : ""}`}
          onClick={() => onMudar({ ...ajustes, proporcao: proximaProporcao[ajustes.proporcao] })}
        >
          <span className="material-symbols-outlined">aspect_ratio</span>
          <span>{ajustes.proporcao}</span>
        </button>

        <button
          className={`settings-square${ajustes.realce ? " active" : ""}`}
          onClick={() => onMudar({ ...ajustes, realce: !ajustes.realce })}
          aria-pressed={ajustes.realce}
        >
          <span className="material-symbols-outlined">brightness_6</span>
          <span>REALCE</span>
        </button>

        <button className="settings-square" onClick={onFocar}>
          <span className="material-symbols-outlined">center_focus_strong</span>
          <span>FOCO</span>
        </button>
      </div>
    </div>
  );
}

export function GavetaFlash({
  modo,
  onModo,
  intensidade,
  onIntensidade,
  disponivel,
}: {
  modo: ModoFlash;
  onModo: (m: ModoFlash) => void;
  intensidade: number;
  onIntensidade: (n: number) => void;
  disponivel: boolean;
}) {
  const opcoes: { valor: ModoFlash; rotulo: string }[] = [
    { valor: "off", rotulo: "DESATIVADO" },
    { valor: "on", rotulo: "ATIVADO" },
    { valor: "auto", rotulo: "AUTO" },
  ];

  return (
    <div className="settings-drawer">
      <div className="drawer-segmented-wrapper">
        <h4 className="drawer-section-title">Modo do Flash</h4>
        <div className="segmented-track">
          {opcoes.map((o) => (
            <button
              key={o.valor}
              className={`flash-drawer-btn${modo === o.valor ? " active" : ""}`}
              onClick={() => onModo(o.valor)}
              aria-pressed={modo === o.valor}
            >
              {o.rotulo}
            </button>
          ))}
        </div>

        <div className="flash-intensity-wrapper">
          <div className="flash-slider-label">
            <span>Intensidade / Nível do Flash</span>
            <span>{intensidade}%</span>
          </div>
          <div className="flash-slider-container">
            <span className="material-symbols-outlined" style={{ fontSize: 16, opacity: 0.5 }}>
              flash_off
            </span>
            <input
              type="range"
              min={10}
              max={100}
              value={intensidade}
              onChange={(e) => onIntensidade(Number(e.target.value))}
              aria-label="Intensidade do flash"
            />
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#ffd600" }}>
              flash_on
            </span>
          </div>
        </div>

        {!disponivel && (
          <p className="drawer-nota">
            Este aparelho não expõe a lanterna pela web. No modo ATIVADO a tela clareia no
            disparo, como flash de tela.
          </p>
        )}
      </div>
    </div>
  );
}

export function GavetaQualidade({
  resolucao,
  onResolucao,
  fps,
  onFps,
  real,
}: {
  resolucao: Resolucao;
  onResolucao: (r: Resolucao) => void;
  fps: Fps;
  onFps: (f: Fps) => void;
  real: { largura: number; altura: number; fps: number } | null;
}) {
  return (
    <div className="settings-drawer">
      <div className="drawer-segmented-wrapper">
        <div className="segmented-group">
          <h4 className="drawer-section-title">Resolução</h4>
          <div className="segmented-track">
            {(["4K", "1080P"] as Resolucao[]).map((r) => (
              <button
                key={r}
                className={`quality-pill-btn${resolucao === r ? " active" : ""}`}
                onClick={() => onResolucao(r)}
                aria-pressed={resolucao === r}
              >
                {r === "4K" ? "4K" : "1080p"}
              </button>
            ))}
          </div>
        </div>

        <div className="segmented-group">
          <h4 className="drawer-section-title">Taxa de quadros</h4>
          <div className="segmented-track">
            {([60, 30] as Fps[]).map((f) => (
              <button
                key={f}
                className={`fps-pill-btn${fps === f ? " active" : ""}`}
                onClick={() => onFps(f)}
                aria-pressed={fps === f}
              >
                {f} fps
              </button>
            ))}
          </div>
        </div>

        {/* O que a câmera entregou de fato: pedir 4K não garante 4K, e sem
            mostrar o real o aluno acha que gravou em uma qualidade que não teve. */}
        <div className="quality-summary-row">
          <span>Entregue pela câmera</span>
          <span>
            {real ? `${real.largura}×${real.altura} a ${real.fps} qps` : "aguardando…"}
          </span>
        </div>
      </div>
    </div>
  );
}
