/* =====================================================================
   CORES AMPLIADAS (estilo Canva) — acrescenta ao seletor de cores do editor:
   quadrado de tonalidade, barra de matiz, código hex, conta-gotas da tela,
   cores usadas nesta cena e cores recentes.
   Aplica a cor escrevendo no próprio campo hexadecimal do editor, então vale
   para contorno, fundo do elemento e fundo da tela.
   ===================================================================== */
const LS_REC = 'tb.coresRecentes';
const lerRec = () => { try { return JSON.parse(localStorage.getItem(LS_REC)) || []; } catch { return []; } };
const gravarRec = c => { try { const l = [c, ...lerRec().filter(x => x !== c)].slice(0, 12); localStorage.setItem(LS_REC, JSON.stringify(l)); } catch {} };

/* conversões */
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
function hexParaRgb(h){
  h = String(h || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const rgbParaHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
function rgbParaHsv(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d){ h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
}
function hsvParaRgb(h, s, v){
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/* escreve no campo hex do editor (o React do editor entende como se a pessoa tivesse digitado) */
function aplicarNoEditor(conteudo, hex){
  const inp = conteudo.querySelector('input.color-picker-input');
  if (!inp) return false;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(inp, hex.replace('#', ''));
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

function montarBloco(conteudo, obterApi){
  const inp = conteudo.querySelector('input.color-picker-input');
  const inicial = hexParaRgb(inp && inp.value) || [30, 30, 30];
  let [h, s, v] = rgbParaHsv(...inicial);
  const bloco = document.createElement('div');
  bloco.className = 'tb-cores';
  const temGotas = 'EyeDropper' in window;
  bloco.innerHTML = `
    <div class="color-picker__heading">Mais cores</div>
    <div class="tb-sv"><canvas></canvas><span class="tb-sv-alvo"></span></div>
    <div class="tb-matiz"><span class="tb-matiz-alvo"></span></div>
    <div class="tb-cores-linha">
      <span class="tb-amostra"></span>
      <input class="tb-hex" spellcheck="false" maxlength="7" aria-label="Código da cor">
      ${temGotas ? '<button type="button" class="tb-gotas" title="Pegar uma cor de qualquer lugar da tela"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22l1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="M15 6l3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4z"/></svg></button>' : ''}
    </div>
    <div class="tb-grupo tb-cena"><div class="color-picker__heading">Nesta cena</div><div class="tb-amostras"></div></div>
    <div class="tb-grupo tb-rec"><div class="color-picker__heading">Recentes</div><div class="tb-amostras"></div></div>`;
  conteudo.appendChild(bloco);

  const sv = bloco.querySelector('.tb-sv'), cv = sv.querySelector('canvas'), alvoSv = sv.querySelector('.tb-sv-alvo');
  const matiz = bloco.querySelector('.tb-matiz'), alvoM = matiz.querySelector('.tb-matiz-alvo');
  const amostra = bloco.querySelector('.tb-amostra'), hex = bloco.querySelector('.tb-hex');
  const atual = () => rgbParaHex(...hsvParaRgb(h, s, v));

  function pintarSv(){
    const w = sv.clientWidth || 200, hh = sv.clientHeight || 120, dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = hh * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    g.fillStyle = `hsl(${h},100%,50%)`; g.fillRect(0, 0, w, hh);
    const gb = g.createLinearGradient(0, 0, w, 0); gb.addColorStop(0, '#fff'); gb.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gb; g.fillRect(0, 0, w, hh);
    const gp = g.createLinearGradient(0, 0, 0, hh); gp.addColorStop(0, 'rgba(0,0,0,0)'); gp.addColorStop(1, '#000');
    g.fillStyle = gp; g.fillRect(0, 0, w, hh);
  }
  function pintar(semHex){
    const c = atual();
    alvoSv.style.left = (s * 100) + '%'; alvoSv.style.top = ((1 - v) * 100) + '%'; alvoSv.style.background = c;
    alvoM.style.left = (h / 360 * 100) + '%'; alvoM.style.background = `hsl(${h},100%,50%)`;
    amostra.style.background = c;
    if (!semHex) hex.value = c.toUpperCase();
  }
  const aplicar = c => { if (aplicarNoEditor(conteudo, c)) gravarRec(c.toLowerCase()); pintarListas(); };
  const definir = c => { const rgb = hexParaRgb(c); if (!rgb) return false; [h, s, v] = rgbParaHsv(...rgb); pintarSv(); pintar(); return true; };

  /* arrastar no quadrado e na barra (dedo, caneta ou mouse) */
  const arrastar = (el, mover) => {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      const em = ev => { mover(limitar((ev.clientX - r.left) / r.width, 0, 1), limitar((ev.clientY - r.top) / r.height, 0, 1)); };
      em(e);
      const mv = ev => em(ev);
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); aplicar(atual()); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  };
  arrastar(sv, (x, y) => { s = x; v = 1 - y; pintar(); });
  arrastar(matiz, x => { h = x * 359.9; pintarSv(); pintar(); });

  /* código hex: aplica com Enter ou ao sair do campo (as teclas não vão para os atalhos do editor) */
  ['keydown', 'keyup', 'keypress'].forEach(ev => hex.addEventListener(ev, e => e.stopPropagation()));
  hex.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); let t = hex.value.trim(); if (!t.startsWith('#')) t = '#' + t; if (definir(t)) aplicar(atual()); } });
  hex.addEventListener('input', () => { let t = hex.value.trim(); if (!t.startsWith('#')) t = '#' + t; const rgb = hexParaRgb(t); if (rgb && t.length === 7){ [h, s, v] = rgbParaHsv(...rgb); pintarSv(); pintar(true); } });
  hex.addEventListener('blur', () => { let t = hex.value.trim(); if (!t.startsWith('#')) t = '#' + t; if (hexParaRgb(t) && t.toLowerCase() !== (inp && '#' + inp.value.toLowerCase())) aplicar(atual()); });

  const gotas = bloco.querySelector('.tb-gotas');
  if (gotas) gotas.onclick = async e => { e.stopPropagation(); try { const r = await new window.EyeDropper().open(); if (definir(r.sRGBHex)) aplicar(atual()); } catch {} };

  /* listas de amostras */
  function pintarListas(){
    const api = obterApi();
    const usadas = new Set();
    if (api){
      api.getSceneElements().forEach(el => {
        [el.strokeColor, el.backgroundColor].forEach(c => { if (c && c !== 'transparent' && /^#/.test(c)) usadas.add(c.toLowerCase().slice(0, 7)); });
      });
      const bg = api.getAppState().viewBackgroundColor; if (bg && /^#/.test(bg)) usadas.add(bg.toLowerCase());
    }
    const enche = (sel, lista) => {
      const g = bloco.querySelector(sel); g.classList.toggle('vazio', !lista.length);
      const c = g.querySelector('.tb-amostras');
      c.innerHTML = lista.map(x => `<button type="button" class="tb-am" title="${x}" style="background:${x}" data-c="${x}"></button>`).join('');
      c.querySelectorAll('[data-c]').forEach(b => b.onclick = ev => { ev.stopPropagation(); definir(b.dataset.c); aplicar(b.dataset.c); });
    };
    enche('.tb-cena', [...usadas].slice(0, 16));
    enche('.tb-rec', lerRec());
  }

  requestAnimationFrame(() => { pintarSv(); pintar(); pintarListas(); });
}

export function ativarCoresAmpliadas(obterApi){
  const ver = () => {
    document.querySelectorAll('.excalidraw .color-picker-content').forEach(c => {
      if (!c.querySelector('.tb-cores') && c.querySelector('input.color-picker-input')) montarBloco(c, obterApi);
    });
  };
  const mo = new MutationObserver(ver);
  mo.observe(document.body, { childList: true, subtree: true });
  return () => mo.disconnect();
}
