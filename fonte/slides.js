/* =====================================================================
   SLIDES — cada QUADRO (ferramenta Quadro, tecla F) da cena vira um slide.
   Ordem: a que o Bispo definir no painel "Slides"; quadros novos entram
   na ordem de leitura (de cima para baixo, da esquerda para a direita).
   Exportação: PDF (jsPDF) e PowerPoint (pptxgenjs), um slide por quadro.
   ===================================================================== */
import { exportToCanvas } from '@excalidraw/excalidraw';
import { jsPDF } from 'jspdf';
import PptxGenJS from 'pptxgenjs';

export const ehQuadro = e => e && !e.isDeleted && (e.type === 'frame' || e.type === 'magicframe');

export function quadrosOrdenados(api, ordem = []){
  if (!api) return [];
  const qs = api.getSceneElements().filter(ehQuadro);
  const pos = new Map(ordem.map((id, i) => [id, i]));
  const leitura = (a, b) => (Math.round(a.y / 80) - Math.round(b.y / 80)) || (a.x - b.x);
  const conhecidos = qs.filter(q => pos.has(q.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id));
  const novos = qs.filter(q => !pos.has(q.id)).sort(leitura);
  return [...conhecidos, ...novos];
}
export const nomeQuadro = (q, i) => (q && q.name) || `Slide ${i + 1}`;

/* imagem de um quadro (ou da cena inteira, se não houver quadros) */
export async function imagemDoQuadro(api, quadro, max = 1920, tipo = 'image/jpeg'){
  const appState = { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false };
  const canvas = await exportToCanvas({
    elements: api.getSceneElements(), appState, files: api.getFiles(),
    exportingFrame: quadro || null, exportPadding: quadro ? 0 : 24,
    getDimensions: (w, h) => { const e = max / Math.max(w, h); return { width: Math.round(w * e), height: Math.round(h * e), scale: e }; },   // amplia ou reduz até "max" px (nítido na projeção)
  });
  return { url: canvas.toDataURL(tipo, .92), w: canvas.width, h: canvas.height, fundo: appState.viewBackgroundColor || '#ffffff' };
}

async function todasAsImagens(api, ordem, aoProgredir){
  const qs = quadrosOrdenados(api, ordem);
  const lista = qs.length ? qs : [null];
  const out = [];
  for (let i = 0; i < lista.length; i++){ aoProgredir && aoProgredir(i + 1, lista.length); out.push(await imagemDoQuadro(api, lista[i])); }
  return out;
}

const nomeArquivo = t => (String(t || 'Tábula').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Tábula');

/* no iPad, abre a folha de compartilhar (Salvar em Arquivos, AirDrop, WhatsApp...); no computador, baixa */
export async function entregarArquivo(blob, nome){
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && navigator.canShare){
    const f = new File([blob], nome, { type: blob.type });
    if (navigator.canShare({ files: [f] })){ try { await navigator.share({ files: [f], title: nome }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

export async function exportarPDF(api, ordem, titulo, aoProgredir){
  const imgs = await todasAsImagens(api, ordem, aoProgredir);
  let doc = null;
  for (const im of imgs){
    const orient = im.w >= im.h ? 'landscape' : 'portrait';
    const pw = im.w / 2, ph = im.h / 2;                                       // 1920 px → 960 pt (tamanho de slide 16:9 padrão)
    if (!doc) doc = new jsPDF({ orientation: orient, unit: 'pt', format: [pw, ph], compress: true });
    else doc.addPage([pw, ph], orient);
    doc.addImage(im.url, 'JPEG', 0, 0, pw, ph, undefined, 'FAST');
  }
  return { blob: doc.output('blob'), nome: nomeArquivo(titulo) + '.pdf', paginas: imgs.length };
}

export async function exportarPPTX(api, ordem, titulo, aoProgredir){
  const imgs = await todasAsImagens(api, ordem, aoProgredir);
  const p = new PptxGenJS();
  const W = 13.333, H = +(W * imgs[0].h / imgs[0].w).toFixed(3);       // tamanho do primeiro slide (16:9 vira 13,33 × 7,5 pol.)
  p.defineLayout({ name: 'TABULA', width: W, height: H }); p.layout = 'TABULA';
  p.title = String(titulo || 'Tábula');
  for (const im of imgs){
    const s = p.addSlide();
    s.background = { color: im.fundo.replace('#', '').slice(0, 6) || 'FFFFFF' };
    const esc = Math.min(W / im.w, H / im.h), w = im.w * esc, h = im.h * esc;      // cabe inteiro, centralizado
    s.addImage({ data: im.url, x: (W - w) / 2, y: (H - h) / 2, w, h });
  }
  const blob = await p.write({ outputType: 'blob' });
  return { blob: new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), nome: nomeArquivo(titulo) + '.pptx', paginas: imgs.length };
}
