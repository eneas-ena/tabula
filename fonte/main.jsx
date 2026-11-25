/* =====================================================================
   TÁBULA — quadro branco do Bispo (editor do Excalidraw, código aberto MIT)
   Fase 1: login com autorização · cenas ilimitadas na nuvem (Supabase) ·
   biblioteca pessoal salva no servidor · fundo pontilhado · réguas ·
   versão na tela · sol/lua · aviso de versão nova · sem zoom por duplo toque.
   O editor é o pacote @excalidraw/excalidraw (licença MIT, © Excalidraw).
   ===================================================================== */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Excalidraw, MainMenu, WelcomeScreen, exportToBlob, serializeAsJSON,
  useHandleLibrary, hashElementsVersion, newElementWith,
  TTDDialog, TTDDialogTrigger, DiagramToCodePlugin,
} from '@excalidraw/excalidraw';
import { ativarCoresAmpliadas } from './cores.js';
import { quadrosOrdenados, nomeQuadro, imagemDoQuadro, exportarPDF, exportarPPTX, entregarArquivo } from './slides.js';
import '@excalidraw/excalidraw/index.css';
import { createClient } from '@supabase/supabase-js';

const VERSAO = window.VERSAO || '0.0.0';
const NOME_APP = 'Tábula';
const SUPA_URL = 'https://ghjbljypxksubmcsvaig.supabase.co';
const SUPA_KEY = 'sb_publishable_qXCYqg1WdmelY9D1mptZXg_U8NdoKby';
const ESQUEMA = 'tabula';

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const agora = () => new Date().toISOString();
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const lerLS = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const limitarN = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dataCurta = iso => { try { const d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const blobParaDataURL = b => new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = () => res(null); f.readAsDataURL(b); });

const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  sol: ic('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  lua: ic('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  atualizar: ic('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>'),
  menu: ic('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  mais: ic('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'),
  novo: ic('<path d="M12 5v14M5 12h14"/>'),
  pasta: ic('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  link: ic('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
};
const IcR = ({ d }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />;
const D_VOLTAR = '<path d="M15 18l-6-6 6-6"/>';
const D_SOL = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const D_LUA = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
const D_LINK = '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>';
const D_PLAY = '<path d="M7 4v16l13-8z"/>';
const D_SLIDES = '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/>';
const D_LASER = '<circle cx="12" cy="12" r="2.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>';
const D_X = '<path d="M18 6L6 18M6 6l12 12"/>';
const D_ANT = '<path d="M15 18l-6-6 6-6"/>';
const D_PROX = '<path d="M9 18l6-6-6-6"/>';
const D_RECARREGAR = '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>';

/* ---------- aviso (rodapé) ---------- */
let tAviso = null;
function aviso(msg, ms = 2800, acao){
  const d = $('#aviso');
  d.innerHTML = `<span>${esc(msg)}</span>` + (acao ? `<button type="button">${esc(acao.rotulo)}</button>` : '');
  if (acao) d.querySelector('button').onclick = () => { d.classList.remove('vis'); acao.fazer(); };
  d.classList.add('vis'); clearTimeout(tAviso);
  if (ms) tAviso = setTimeout(() => d.classList.remove('vis'), ms);
}

/* ---------- modais simples ---------- */
function modal(html, aoMontar){
  const f = document.createElement('div'); f.className = 'fundo-modal';
  f.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(f);
  const fechar = () => f.remove();
  f.addEventListener('pointerdown', e => { if (e.target === f) fechar(); });
  aoMontar && aoMontar(f.firstElementChild, fechar);
  return fechar;
}
const pedirTexto = (titulo, valor = '') => new Promise(res => {
  modal(`<h2>${esc(titulo)}</h2><input class="campo" value="${esc(valor)}"><div class="acoes"><button class="bt" data-x>Cancelar</button><button class="bt pri" data-ok>OK</button></div>`, (m, fechar) => {
    const inp = $('input', m); setTimeout(() => { inp.focus(); inp.select(); }, 60);
    const ok = () => { const v = inp.value.trim(); fechar(); res(v || null); };
    $('[data-ok]', m).onclick = ok; $('[data-x]', m).onclick = () => { fechar(); res(null); };
    inp.onkeydown = e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') { fechar(); res(null); } };
  });
});
const confirmar = (titulo, texto, rotulo = 'Confirmar', perigo = false) => new Promise(res => {
  modal(`<h2>${esc(titulo)}</h2><div>${esc(texto)}</div><div class="acoes"><button class="bt" data-x>Cancelar</button><button class="bt ${perigo ? 'perigo' : 'pri'}" data-ok>${esc(rotulo)}</button></div>`, (m, fechar) => {
    $('[data-ok]', m).onclick = () => { fechar(); res(true); }; $('[data-x]', m).onclick = () => { fechar(); res(false); };
  });
});
function menuFlutuante(ancora, itens){
  document.querySelectorAll('.menu-flut').forEach(x => x.remove());
  const m = document.createElement('div'); m.className = 'menu-flut';
  itens.forEach(it => {
    if (it.info){ const d = document.createElement('div'); d.className = 'info'; d.textContent = it.info; m.appendChild(d); return; }
    const b = document.createElement('button'); b.textContent = it.rotulo; if (it.perigo) b.className = 'perigo';
    b.onclick = () => { m.remove(); it.fazer(); }; m.appendChild(b);
  });
  document.body.appendChild(m);
  const r = ancora.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  m.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', function fora(e){ if (!m.contains(e.target)){ m.remove(); document.removeEventListener('pointerdown', fora); } }), 0);
}

/* ---------- tema (sol/lua) ---------- */
let tema = lerLS('tb.tema', 'claro') === 'escuro' ? 'escuro' : 'claro';
const ouvintesTema = new Set();
function aplicarTema(t){
  tema = t; document.documentElement.dataset.tema = t;
  try { localStorage.setItem('tb.tema', t); } catch {}
  ouvintesTema.forEach(f => f(t));
  document.querySelectorAll('[data-bt-tema]').forEach(b => { b.innerHTML = t === 'escuro' ? I.sol : I.lua; b.title = t === 'escuro' ? 'Modo claro' : 'Modo escuro'; });
}
const trocarTema = () => aplicarTema(tema === 'escuro' ? 'claro' : 'escuro');

/* ---------- impedir zoom por duplo toque / pinça fora do quadro (iPad) ---------- */
['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
let ultimoToque = 0;
document.addEventListener('touchend', e => {
  if (e.target.closest && e.target.closest('.excalidraw')) return;   // dentro do quadro o próprio editor cuida (duplo toque = editar texto)
  const t = Date.now(); if (t - ultimoToque < 320) e.preventDefault(); ultimoToque = t;
}, { passive: false });

/* ---------- versão nova ---------- */
let avisouVersao = null;
async function verificarVersao(manual){
  if (!navigator.onLine){ if (manual) aviso('Sem internet para verificar.'); return; }
  try {
    const r = await fetch(location.pathname + '?nc=' + Date.now(), { cache: 'no-store', headers: { Range: 'bytes=0-4095' } });
    const m = (await r.text()).match(/window\.VERSAO = '([^']+)'/), v = m && m[1];
    if (v && v !== VERSAO){ if (manual || avisouVersao !== v){ avisouVersao = v; aviso(`Nova versão da ${NOME_APP} disponível (v${v}).`, 0, { rotulo: 'Atualizar agora', fazer: atualizarApp }); } }
    else if (manual) aviso(`Você já está na versão mais nova (v${VERSAO}).`);
  } catch { if (manual) aviso('Não consegui verificar agora.'); }
}
async function atualizarApp(){
  try { if (editorAtual) await editorAtual.salvarAgora(true); } catch {}
  try { if ('serviceWorker' in navigator){ const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } } catch {}
  try { if (window.caches){ const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch {}
  location.replace(location.pathname + '?v=' + Date.now());
}

/* =====================================================================
   GUARDA NO APARELHO (IndexedDB) — funciona sem internet
   ===================================================================== */
const IDB = (() => {
  let p = null;
  const abrir = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('tabula', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (modo, fn) => { const db = await abrir(); return new Promise((res, rej) => { const t = db.transaction('kv', modo); const s = t.objectStore('kv'); const out = fn(s); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); };
  return {
    ler: k => tx('readonly', s => s.get(k)).catch(() => undefined),
    gravar: (k, v) => tx('readwrite', s => s.put(v, k)).catch(() => {}),
    apagar: k => tx('readwrite', s => s.delete(k)).catch(() => {}),
    chaves: () => tx('readonly', s => s.getAllKeys()).catch(() => []),
    zerar: () => tx('readwrite', s => s.clear()).catch(() => {}),
  };
})();

/* =====================================================================
   SUPABASE — login, autorização e cenas
   ===================================================================== */
const sb = createClient(SUPA_URL, SUPA_KEY, {
  auth: { storageKey: 'bispo-auth', persistSession: true, autoRefreshToken: true },
  db: { schema: ESQUEMA },
});
let usuario = null, perfil = lerLS('tb.perfil', null);

function mostrarLogin(msg){
  $('#telaCenas').classList.add('oculto'); $('#telaEditor').classList.add('oculto');
  let d = $('#login');
  if (!d){ d = document.createElement('div'); d.id = 'login'; document.body.appendChild(d); }
  const modoEntrar = () => {
    d.innerHTML = `<form autocomplete="on"><h1>${NOME_APP}</h1><p class="lema">“Escreve a visão e torna-a bem legível sobre tábuas.” Hc 2.2</p>
      <label for="lgEmail">E-mail</label><input class="campo" id="lgEmail" type="email" inputmode="email" autocomplete="username" value="${esc(localStorage.getItem('bispo-email') || '')}">
      <label for="lgSenha">Senha</label><input class="campo" id="lgSenha" type="password" autocomplete="current-password">
      <button type="submit" id="lgBtn">Entrar</button><div class="erro" id="loginErro">${esc(msg || '')}</div>
      <button type="button" class="link" id="lgPedir">Não tem conta? Pedir acesso</button><div class="ver">v${VERSAO}</div></form>`;
    $('#lgPedir', d).onclick = modoPedir;
    $('form', d).onsubmit = async ev => {
      ev.preventDefault();
      const email = $('#lgEmail', d).value.trim(), senha = $('#lgSenha', d).value, err = $('#loginErro', d), btn = $('#lgBtn', d);
      if (!email || !senha){ err.textContent = 'Preencha e-mail e senha.'; return; }
      btn.disabled = true; btn.textContent = 'Entrando...';
      const r = await sb.auth.signInWithPassword({ email, password: senha });
      btn.disabled = false; btn.textContent = 'Entrar';
      if (r.error){
        const m = r.error.message || '';
        err.textContent = /not confirmed/i.test(m) ? 'Este e-mail ainda não foi confirmado. Abra o e-mail de confirmação (veja também o lixo eletrônico) e toque no link.'
          : /invalid/i.test(m) ? 'E-mail ou senha incorretos.'
          : /fetch|network|Failed/i.test(m) ? 'Sem conexão com o servidor. Confira a internet.'
          : 'Não foi possível entrar: ' + m;
        return;
      }
      try { localStorage.setItem('bispo-email', email); } catch {}
      d.remove(); await entrar(r.data.user);
    };
    setTimeout(() => { const a = $($('#lgEmail', d).value ? '#lgSenha' : '#lgEmail', d); a && a.focus(); }, 80);
  };
  const modoPedir = () => {
    d.innerHTML = `<form><h1>${NOME_APP}</h1><p class="lema">Pedir acesso</p>
      <label>Nome</label><input class="campo" id="pdNome" autocomplete="name">
      <label>E-mail</label><input class="campo" id="pdEmail" type="email" inputmode="email" autocomplete="username">
      <label>Senha (mínimo 6 caracteres)</label><input class="campo" id="pdSenha" type="password" autocomplete="new-password">
      <button type="submit" id="pdBtn">Pedir acesso</button><div class="erro" id="pdMsg"></div>
      <button type="button" class="link" id="pdVoltar">Já tenho conta — entrar</button><div class="ver">v${VERSAO}</div></form>`;
    $('#pdVoltar', d).onclick = () => { msg = ''; modoEntrar(); };
    $('form', d).onsubmit = async ev => {
      ev.preventDefault();
      const nome = $('#pdNome', d).value.trim(), email = $('#pdEmail', d).value.trim().toLowerCase(), senha = $('#pdSenha', d).value, m = $('#pdMsg', d), b = $('#pdBtn', d);
      m.className = 'erro';
      if (!nome || !email || senha.length < 6){ m.textContent = 'Preencha nome, e-mail e uma senha de 6 caracteres ou mais.'; return; }
      b.disabled = true;
      const r = await sb.auth.signUp({ email, password: senha, options: { data: { nome } } });
      b.disabled = false;
      if (r.error){
        const t = r.error.message || '';
        m.textContent = /registered|exists/i.test(t) ? 'Esse e-mail já tem conta. Volte e entre com a senha.' : /not allowed|disabled/i.test(t) ? 'O cadastro de novas contas está desligado no momento.' : 'Não consegui criar: ' + t;
        return;
      }
      if (r.data.session){ d.remove(); await entrar(r.data.user); return; }
      m.className = 'erro ok';
      m.textContent = 'Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre. O acesso será liberado após autorização.';
    };
  };
  modoEntrar();
}

function telaMensagem(titulo, texto, botoes = []){
  const t = $('#telaCenas'); t.classList.remove('oculto'); $('#telaEditor').classList.add('oculto');
  t.innerHTML = `<div class="barra"><span class="marca">${NOME_APP}</span><span class="versao">v${VERSAO}</span><span class="esp"></span>
    <button class="bt-ic" data-bt-tema></button></div>
    <div class="rolagem"><div class="modal" style="margin:30px auto;box-shadow:none;border:1px solid var(--borda)"><h2>${esc(titulo)}</h2><div style="line-height:1.5">${texto}</div><div class="acoes"></div></div></div>`;
  const a = $('.acoes', t);
  botoes.forEach(b => { const x = document.createElement('button'); x.className = 'bt' + (b.pri ? ' pri' : ''); x.textContent = b.rotulo; x.onclick = b.fazer; a.appendChild(x); });
  $('[data-bt-tema]', t).onclick = trocarTema; aplicarTema(tema);
}

async function sair(){
  if (editorAtual){ try { await editorAtual.salvarAgora(true); } catch {} }
  const pend = (await IDB.chaves()).some(k => String(k).startsWith('pend:'));
  if (pend && !(await confirmar('Sair da conta', 'Há alterações que ainda não subiram para a nuvem. Se sair agora, elas se perdem neste aparelho.', 'Sair mesmo assim', true))) return;
  try { await sb.auth.signOut(); } catch {}
  await IDB.zerar(); localStorage.removeItem('tb.perfil'); location.reload();
}

/* registra o usuário na Tábula e lê se está autorizado (o primeiro a entrar vira administrador) */
async function entrar(u){
  usuario = u;
  const anterior = lerLS('tb.uid', null);
  if (anterior && anterior !== u.id){ await IDB.zerar(); }
  gravarLS('tb.uid', u.id);
  if (navigator.onLine){
    const r = await sb.rpc('registrar');
    if (r.error){
      const m = r.error.message || '';
      if (/schema|does not exist|not find|PGRST/i.test(m + ' ' + (r.error.code || ''))){
        telaMensagem('Falta preparar o banco', `Rode no Supabase (SQL Editor) o arquivo <b>tabula.sql</b> e acrescente <b>tabula</b> em <i>Project Settings → Data API → Exposed schemas</i>. Depois toque em “Tentar de novo”.<br><br><small style="color:var(--sub)">Detalhe: ${esc(m)}</small>`,
          [{ rotulo: 'Sair', fazer: sair }, { rotulo: 'Tentar de novo', pri: true, fazer: () => entrar(u) }]);
        return;
      }
      if (!perfil){ telaMensagem('Não consegui verificar o acesso', esc(m), [{ rotulo: 'Tentar de novo', pri: true, fazer: () => entrar(u) }]); return; }
    } else { perfil = r.data; gravarLS('tb.perfil', perfil); }
  }
  if (!perfil){ telaMensagem('Sem internet', 'Abra a Tábula com internet pelo menos uma vez para liberar o acesso neste aparelho.', [{ rotulo: 'Tentar de novo', pri: true, fazer: () => entrar(u) }]); return; }
  if (!perfil.aprovado){
    telaMensagem('Aguardando autorização', `Olá, ${esc(perfil.nome || u.email)}. Seu pedido de acesso foi registrado. Assim que o administrador autorizar, é só tocar em “Verificar de novo”.`,
      [{ rotulo: 'Sair', fazer: sair }, { rotulo: 'Verificar de novo', pri: true, fazer: () => entrar(u) }]);
    return;
  }
  await enviarPendentes();
  mostrarCenas();
}

/* ---------- cenas: nuvem + aparelho ---------- */
const COLS_LISTA = 'id,titulo,miniatura,atualizado_em';
const COLS_LISTA2 = COLS_LISTA + ',pasta_id,compartilhada,link_token';
let etapa2 = true, avisouEtapa2 = false;
const faltaColuna = e => e && /column|pasta|compartilh|link_token|42703|PGRST204|42P01|relation/i.test((e.message || '') + ' ' + (e.code || ''));
function semEtapa2(){
  etapa2 = false;
  if (!avisouEtapa2){ avisouEtapa2 = true; aviso('Para usar pastas e links, rode no Supabase o arquivo tabula-etapa2.sql.', 9000); }
}
async function listarCenas(){
  let lista = (await IDB.ler('lista')) || [];
  if (navigator.onLine && usuario){
    let r = await sb.from('cenas').select(etapa2 ? COLS_LISTA2 : COLS_LISTA).eq('apagado', false).order('atualizado_em', { ascending: false });
    if (r.error && etapa2 && faltaColuna(r.error)){ semEtapa2(); r = await sb.from('cenas').select(COLS_LISTA).eq('apagado', false).order('atualizado_em', { ascending: false }); }
    if (!r.error){ lista = r.data; await IDB.gravar('lista', lista); }
  }
  // cenas salvas só no aparelho (sem internet) aparecem também
  for (const k of await IDB.chaves()){
    if (!String(k).startsWith('pend:')) continue;
    const c = await IDB.ler(k); if (!c) continue;
    const i = lista.findIndex(x => x.id === c.id), resumo = { id: c.id, titulo: c.titulo, miniatura: c.miniatura, atualizado_em: c.atualizado_em, pasta_id: c.pasta_id || null };
    if (i < 0) lista.unshift(resumo); else if (c.atualizado_em > lista[i].atualizado_em) lista[i] = { ...lista[i], ...resumo, pasta_id: lista[i].pasta_id ?? resumo.pasta_id };
  }
  return lista.sort((a, b) => (b.atualizado_em || '').localeCompare(a.atualizado_em || ''));
}
async function lerCena(id){
  const local = await IDB.ler('cena:' + id), pend = await IDB.ler('pend:' + id);
  if (pend) return pend;                               // alteração ainda não enviada vence
  if (navigator.onLine){
    let r = await sb.from('cenas').select('id,titulo,dados,miniatura,atualizado_em' + (etapa2 ? ',pasta_id' : '')).eq('id', id).maybeSingle();
    if (r.error && etapa2 && faltaColuna(r.error)){ semEtapa2(); r = await sb.from('cenas').select('id,titulo,dados,miniatura,atualizado_em').eq('id', id).maybeSingle(); }
    if (!r.error && r.data){ await IDB.gravar('cena:' + id, r.data); return r.data; }
  }
  return local || null;
}
/* grava no aparelho e tenta subir; se não der, fica marcado como pendente */
async function gravarCena(c){
  await IDB.gravar('cena:' + c.id, c);
  await IDB.gravar('pend:' + c.id, c);
  if (!navigator.onLine || !usuario) return 'pend';
  const linha = { id: c.id, titulo: c.titulo, dados: c.dados, atualizado_em: c.atualizado_em };
  if (c.miniatura !== undefined) linha.miniatura = c.miniatura;
  if (c.nova && etapa2 && c.pasta_id) linha.pasta_id = c.pasta_id;      // só ao criar: a pasta muda pelo menu "Mover"
  const r = await sb.from('cenas').upsert(linha);
  if (r.error){ console.warn(r.error); return 'erro'; }
  const atual = await IDB.ler('pend:' + c.id);
  if (atual && atual.atualizado_em === c.atualizado_em) await IDB.apagar('pend:' + c.id);
  return 'ok';
}
async function enviarPendentes(){
  if (!navigator.onLine || !usuario) return;
  for (const k of await IDB.chaves()){
    if (!String(k).startsWith('pend:')) continue;
    const c = await IDB.ler(k); if (c) await gravarCena(c);
  }
}
window.addEventListener('online', () => { enviarPendentes().then(() => { if (!$('#telaCenas').classList.contains('oculto')) pintarCenas(); }); });

/* ---------- biblioteca pessoal (salva no servidor) ---------- */
const bibliotecaAdapter = {
  async load(){
    if (navigator.onLine && usuario){
      const r = await sb.from('biblioteca').select('itens').maybeSingle();
      if (!r.error){ const itens = (r.data && r.data.itens) || []; await IDB.gravar('biblioteca', itens); return { libraryItems: itens }; }
    }
    return { libraryItems: (await IDB.ler('biblioteca')) || [] };
  },
  async save({ libraryItems }){
    await IDB.gravar('biblioteca', libraryItems);
    if (navigator.onLine && usuario){
      const r = await sb.from('biblioteca').upsert({ user_id: usuario.id, itens: libraryItems, atualizado_em: agora() });
      if (r.error) console.warn(r.error);
    }
  },
};

/* =====================================================================
   ASSISTENTE DE IA (Worker "tabula-ia" no Cloudflare)
   O endereço fica guardado na própria conta (vale no iPad e no Mac).
   ===================================================================== */
const iaUrl = () => ((usuario && usuario.user_metadata && usuario.user_metadata.tabula_ia) || lerLS('tb.ia', '') || '').replace(/\/+$/, '');
async function chamarIA(rota, corpo){
  const base = iaUrl();
  if (!base) throw new Error('O assistente de IA ainda não foi configurado. Toque em ☰ → "Assistente de IA…" e cole o endereço do Worker.');
  if (!navigator.onLine) throw new Error('Sem internet.');
  const s = (await sb.auth.getSession()).data.session;
  if (!s) throw new Error('Entre na sua conta de novo.');
  let r;
  try { r = await fetch(base + rota, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify(corpo) }); }
  catch { throw new Error('Não consegui falar com o assistente de IA. Confira o endereço em ☰ → "Assistente de IA…".'); }
  let d = {}; try { d = await r.json(); } catch {}
  if (!r.ok || d.erro) throw new Error(d.erro || ('Erro ' + r.status));
  return d;
}
function configurarIA(){
  modal(`<h2>Assistente de IA</h2>
    <p class="dica">Cole o endereço do Worker <b>tabula-ia</b> do Cloudflare (ex.: https://tabula-ia.<i>seu-nome</i>.workers.dev). Fica salvo na sua conta e vale em todos os aparelhos.</p>
    <input class="campo" id="iaUrl" placeholder="https://tabula-ia....workers.dev" value="${esc(iaUrl())}" inputmode="url" autocapitalize="off" spellcheck="false">
    <div class="dica" id="iaMsg" style="margin-top:10px"></div>
    <div class="acoes"><button class="bt" data-x>Fechar</button><button class="bt" id="iaTestar">Testar</button><button class="bt pri" id="iaSalvar">Salvar</button></div>`, (m, fechar) => {
    $('[data-x]', m).onclick = fechar;
    const msg = (t, ok) => { const e = $('#iaMsg', m); e.textContent = t; e.style.color = ok === true ? '#1E9E50' : ok === false ? '#C0392B' : ''; };
    const valor = () => $('#iaUrl', m).value.trim().replace(/\/+$/, '');
    $('#iaTestar', m).onclick = async () => {
      const u = valor(); if (!/^https:\/\//.test(u)) return msg('O endereço deve começar com https://', false);
      msg('Testando…');
      try { const r = await fetch(u + '/saude'); const d = await r.json();
        if (!d.ok) return msg('Respondeu, mas não parece ser o tabula-ia.', false);
        msg(d.chave ? `Funcionando ✓ (modelo ${d.modelo})` : 'O Worker respondeu, mas falta o segredo ANTHROPIC_API_KEY.', !!d.chave);
      } catch { msg('Não consegui acessar esse endereço.', false); }
    };
    $('#iaSalvar', m).onclick = async () => {
      const u = valor(); if (u && !/^https:\/\//.test(u)) return msg('O endereço deve começar com https://', false);
      gravarLS('tb.ia', u);
      if (navigator.onLine && usuario){ const r = await sb.auth.updateUser({ data: { tabula_ia: u } }); if (!r.error && r.data && r.data.user) usuario = r.data.user; }
      msg('Salvo ✓', true); setTimeout(fechar, 700);
    };
  });
}

/* =====================================================================
   TELA DAS CENAS
   ===================================================================== */
let filtro = '', listaAtual = [], pastas = [], pastaAtual = lerLS('tb.pasta', 'todas');
const ehUuid = v => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const nomePasta = id => (pastas.find(p => p.id === id) || {}).nome;

async function listarPastas(){
  let l = (await IDB.ler('pastas')) || [];
  if (navigator.onLine && usuario && etapa2){
    const r = await sb.from('pastas').select('id,nome,ordem').order('ordem').order('nome');
    if (r.error){ if (faltaColuna(r.error)) semEtapa2(); }
    else { l = r.data; await IDB.gravar('pastas', l); }
  }
  return l;
}

function mostrarCenas(){
  const t = $('#telaCenas'); t.classList.remove('oculto'); $('#telaEditor').classList.add('oculto');
  t.innerHTML = `<div class="barra"><span class="marca">${NOME_APP}</span><span class="versao">v${VERSAO}</span><span class="esp"></span>
    <input class="busca" placeholder="Buscar cena…" value="${esc(filtro)}">
    <button class="bt-ouro" id="btNova">+ Nova cena</button>
    <button class="bt-ic" data-bt-tema></button>
    <button class="bt-ic" id="btAtualizar" title="Atualizar app">${I.atualizar}</button>
    <button class="bt-ic" id="btMenu" title="Ajustes">${I.menu}</button></div>
    <div class="pastas" id="pastas"></div>
    <div class="rolagem"><div class="titulo-sec" id="tituloSec">Minhas cenas</div><div class="grade" id="grade"></div></div>`;
  $('[data-bt-tema]', t).onclick = trocarTema; aplicarTema(tema);
  $('#btNova', t).onclick = novaCena;
  $('#btAtualizar', t).onclick = atualizarApp;
  $('#btMenu', t).onclick = e => menuFlutuante(e.currentTarget, [
    { info: `${perfil && perfil.nome || ''} · ${usuario && usuario.email || ''}` },
    { info: `${NOME_APP} · v${VERSAO}` },
    { rotulo: 'Verificar atualização', fazer: () => verificarVersao(true) },
    { rotulo: 'Atualizar app agora', fazer: atualizarApp },
    { rotulo: 'Assistente de IA…', fazer: configurarIA },
    ...(perfil && perfil.admin ? [{ rotulo: 'Acessos (autorizar pessoas)', fazer: abrirAcessos }] : []),
    { rotulo: 'Sair da conta', perigo: true, fazer: sair },
  ]);
  $('.busca', t).oninput = e => { filtro = e.target.value; desenharGrade(); };
  pintarCenas();
}
async function pintarCenas(){
  const g = $('#grade'); if (!g) return;
  if (!listaAtual.length) g.innerHTML = '<div class="vazio-lista">Carregando…</div>';
  listaAtual = await listarCenas();
  pastas = await listarPastas();
  if (ehUuid(pastaAtual) && !pastas.some(p => p.id === pastaAtual)) pastaAtual = 'todas';
  desenharPastas(); desenharGrade();
}

/* ---------- faixa de pastas ---------- */
function desenharPastas(){
  const d = $('#pastas'); if (!d) return;
  if (!etapa2){ d.classList.add('oculto'); return; }
  d.classList.remove('oculto');
  const conta = id => listaAtual.filter(c => id === 'todas' ? true : id === 'sem' ? !c.pasta_id : c.pasta_id === id).length;
  const chip = (id, nome) => `<button class="chip${pastaAtual === id ? ' ativo' : ''}" data-pasta="${id}">${ehUuid(id) ? I.pasta : ''}<span>${esc(nome)}</span><small>${conta(id)}</small>${pastaAtual === id && ehUuid(id) ? `<i data-opc-pasta="${id}">${I.mais}</i>` : ''}</button>`;
  d.innerHTML = chip('todas', 'Todas') + chip('sem', 'Sem pasta') + pastas.map(p => chip(p.id, p.nome)).join('') +
    `<button class="chip novo" id="btNovaPasta">${I.novo}<span>Pasta</span></button>`;
  d.querySelectorAll('[data-pasta]').forEach(b => b.onclick = e => {
    const op = e.target.closest('[data-opc-pasta]');
    if (op){ e.stopPropagation(); const p = pastas.find(x => x.id === op.dataset.opcPasta);
      return menuFlutuante(op, [{ rotulo: 'Renomear pasta', fazer: () => renomearPasta(p) }, { rotulo: 'Apagar pasta', perigo: true, fazer: () => apagarPasta(p) }]); }
    pastaAtual = b.dataset.pasta; gravarLS('tb.pasta', pastaAtual); desenharPastas(); desenharGrade();
  });
  $('#btNovaPasta', d).onclick = criarPasta;
}
async function criarPasta(){
  if (!navigator.onLine) return aviso('Precisa de internet para criar pasta.');
  const nome = await pedirTexto('Nome da nova pasta', ''); if (!nome) return;
  const r = await sb.from('pastas').insert({ nome, ordem: pastas.length }).select('id,nome,ordem').single();
  if (r.error) return aviso('Não consegui criar: ' + r.error.message, 5000);
  pastas.push(r.data); await IDB.gravar('pastas', pastas);
  pastaAtual = r.data.id; gravarLS('tb.pasta', pastaAtual); desenharPastas(); desenharGrade();
}
async function renomearPasta(p){
  const nome = await pedirTexto('Renomear pasta', p.nome); if (!nome || nome === p.nome) return;
  const r = await sb.from('pastas').update({ nome }).eq('id', p.id);
  if (r.error) return aviso('Não consegui renomear: ' + r.error.message, 5000);
  p.nome = nome; await IDB.gravar('pastas', pastas); desenharPastas(); desenharGrade();
}
async function apagarPasta(p){
  if (!(await confirmar('Apagar pasta', `Apagar a pasta “${p.nome}”? As cenas dela NÃO são apagadas: vão para “Sem pasta”.`, 'Apagar pasta', true))) return;
  const r = await sb.from('pastas').delete().eq('id', p.id);
  if (r.error) return aviso('Não consegui apagar: ' + r.error.message, 5000);
  pastas = pastas.filter(x => x.id !== p.id); await IDB.gravar('pastas', pastas);
  listaAtual.forEach(c => { if (c.pasta_id === p.id) c.pasta_id = null; });
  pastaAtual = 'todas'; gravarLS('tb.pasta', pastaAtual); desenharPastas(); desenharGrade(); aviso('Pasta apagada.');
}
async function moverCena(c, pastaId){
  if (!navigator.onLine) return aviso('Precisa de internet para mover.');
  const r = await sb.from('cenas').update({ pasta_id: pastaId }).eq('id', c.id).select('id');
  if (r.error) return aviso('Não consegui mover: ' + r.error.message, 5000);
  if (!r.data || !r.data.length) return aviso('Essa cena ainda não subiu para a nuvem. Tente de novo em instantes.');
  c.pasta_id = pastaId;
  for (const k of ['cena:', 'pend:']){ const x = await IDB.ler(k + c.id); if (x){ x.pasta_id = pastaId; await IDB.gravar(k + c.id, x); } }
  desenharPastas(); desenharGrade(); aviso(pastaId ? `Movida para “${nomePasta(pastaId)}”.` : 'Movida para “Sem pasta”.');
}

/* ---------- grade de cenas ---------- */
function desenharGrade(){
  const g = $('#grade'); if (!g) return;
  const f = filtro.trim().toLowerCase();
  const naPasta = c => !etapa2 || pastaAtual === 'todas' ? true : pastaAtual === 'sem' ? !c.pasta_id : c.pasta_id === pastaAtual;
  const itens = listaAtual.filter(c => naPasta(c) && (!f || (c.titulo || '').toLowerCase().includes(f)));
  const ts = $('#tituloSec'); if (ts) ts.textContent = !etapa2 || pastaAtual === 'todas' ? 'Minhas cenas' : pastaAtual === 'sem' ? 'Cenas sem pasta' : (nomePasta(pastaAtual) || 'Minhas cenas');
  g.innerHTML = `<div class="cartao nova" id="cNova">${I.novo}<span>Nova cena</span></div>` + itens.map(c => `
    <div class="cartao" data-id="${c.id}">
      <div class="mini">${c.miniatura ? `<img src="${c.miniatura}" alt="">` : '<span class="vazio">em branco</span>'}
        ${c.compartilhada ? `<span class="selo-link" title="Compartilhada por link">${I.link}</span>` : ''}</div>
      <div class="info"><div style="flex:1;min-width:0"><div class="nome">${esc(c.titulo || 'Sem título')}</div>
        <div class="data">${dataCurta(c.atualizado_em)}${pastaAtual === 'todas' && c.pasta_id && nomePasta(c.pasta_id) ? ' · ' + esc(nomePasta(c.pasta_id)) : ''}</div></div>
      <button class="mais" data-mais="${c.id}" title="Opções">${I.mais}</button></div>
    </div>`).join('') + (!itens.length ? `<div class="vazio-lista">${f ? 'Nenhuma cena com esse nome.' : 'Nenhuma cena aqui ainda.'}</div>` : '');
  $('#cNova', g).onclick = novaCena;
  g.querySelectorAll('.cartao[data-id]').forEach(el => el.onclick = e => { if (e.target.closest('[data-mais]')) return; abrirCena(el.dataset.id); });
  g.querySelectorAll('[data-mais]').forEach(b => b.onclick = e => {
    e.stopPropagation(); const id = b.dataset.mais, c = listaAtual.find(x => x.id === id);
    menuFlutuante(b, [
      { rotulo: 'Abrir', fazer: () => abrirCena(id) },
      { rotulo: 'Renomear', fazer: () => renomearCena(c) },
      ...(etapa2 ? [
        { rotulo: 'Mover para pasta…', fazer: () => menuFlutuante(b, [
          { info: 'Mover para:' },
          { rotulo: (c.pasta_id ? '' : '✓ ') + 'Sem pasta', fazer: () => moverCena(c, null) },
          ...pastas.map(p => ({ rotulo: (c.pasta_id === p.id ? '✓ ' : '') + p.nome, fazer: () => moverCena(c, p.id) })),
        ]) },
        { rotulo: 'Compartilhar link…', fazer: () => abrirCompartilhar(c.id, c.titulo, () => pintarCenas()) },
      ] : []),
      { rotulo: 'Duplicar', fazer: () => duplicarCena(c) },
      { rotulo: 'Apagar', perigo: true, fazer: () => apagarCena(c) },
    ]);
  });
}
async function novaCena(){
  const titulo = await pedirTexto('Nome da nova cena', 'Sem título'); if (!titulo) return;
  abrirCena(null, titulo);
}
async function renomearCena(c){
  const t = await pedirTexto('Renomear cena', c.titulo); if (!t || t === c.titulo) return;
  const cena = await lerCena(c.id); if (!cena) return aviso('Não consegui abrir essa cena agora.');
  cena.titulo = t; cena.atualizado_em = agora();
  const st = await gravarCena(cena); aviso(st === 'ok' ? 'Renomeada.' : 'Renomeada no aparelho; sobe quando houver internet.');
  pintarCenas();
}
async function duplicarCena(c){
  const cena = await lerCena(c.id); if (!cena) return aviso('Não consegui abrir essa cena agora.');
  const nova = { id: novoId(), titulo: (cena.titulo || 'Sem título') + ' (cópia)', dados: cena.dados, miniatura: cena.miniatura || null, atualizado_em: agora(), pasta_id: c.pasta_id || null, nova: true };
  await gravarCena(nova); aviso('Cena duplicada.'); pintarCenas();
}
async function apagarCena(c){
  if (!(await confirmar('Apagar cena', `Apagar “${c.titulo || 'Sem título'}”?`, 'Apagar', true))) return;
  if (!navigator.onLine) return aviso('Precisa de internet para apagar.');
  const r = await sb.from('cenas').update({ apagado: true, atualizado_em: agora() }).eq('id', c.id);
  if (r.error) return aviso('Não consegui apagar: ' + r.error.message, 5000);
  await IDB.apagar('cena:' + c.id); await IDB.apagar('pend:' + c.id);
  listaAtual = listaAtual.filter(x => x.id !== c.id); desenharPastas(); desenharGrade(); aviso('Cena apagada.');
}

/* ---------- compartilhar por link (só visualizar) ---------- */
const linkDaCena = token => location.origin + location.pathname + '?ver=' + token;
async function abrirCompartilhar(id, titulo, aoMudar){
  if (!etapa2) return aviso('Rode no Supabase o arquivo tabula-etapa2.sql para liberar os links.', 6000);
  if (!navigator.onLine) return aviso('Precisa de internet para compartilhar.');
  const r = await sb.from('cenas').select('compartilhada,link_token').eq('id', id).maybeSingle();
  if (r.error) return aviso('Erro: ' + r.error.message, 5000);
  if (!r.data) return aviso('Desenhe algo na cena primeiro: ela ainda não foi salva na nuvem.', 5000);
  let estado = { ...r.data };
  modal(`<h2>Compartilhar “${esc(titulo || 'Sem título')}”</h2>
    <p style="margin:0 0 12px;line-height:1.45;color:var(--sub)">Quem tiver o link vê o desenho, mas não consegue alterar. Não precisa de conta.</p>
    <label class="linha-aj" style="cursor:pointer"><span class="tx"><b>Link ativo</b><small id="shEstado"></small></span><input type="checkbox" id="shAtivo" style="width:22px;height:22px"></label>
    <div id="shCaixa"><input class="campo" id="shLink" readonly style="margin-top:12px;font-size:13px">
      <div class="acoes" style="justify-content:flex-start;flex-wrap:wrap">
        <button class="bt pri" id="shCopiar">Copiar link</button>
        ${navigator.share ? '<button class="bt" id="shEnviar">Enviar…</button>' : ''}
        <button class="bt" id="shNovo">Gerar novo link</button>
      </div></div>
    <div class="acoes"><button class="bt" data-x>Fechar</button></div>`, (m, fechar) => {
    $('[data-x]', m).onclick = fechar;
    const pintar = () => {
      $('#shAtivo', m).checked = !!estado.compartilhada;
      $('#shEstado', m).textContent = estado.compartilhada ? 'Qualquer pessoa com o link pode ver' : 'Desligado — o link não abre';
      $('#shCaixa', m).classList.toggle('oculto', !estado.compartilhada);
      if (estado.link_token) $('#shLink', m).value = linkDaCena(estado.link_token);
    };
    const gravar = async mud => {
      const x = await sb.from('cenas').update(mud).eq('id', id).select('compartilhada,link_token').single();
      if (x.error){ aviso('Erro: ' + x.error.message, 5000); return false; }
      estado = x.data; pintar(); aoMudar && aoMudar(estado); return true;
    };
    $('#shAtivo', m).onchange = e => gravar(e.target.checked ? { compartilhada: true, link_token: estado.link_token || novoId() } : { compartilhada: false });
    $('#shCopiar', m).onclick = async () => {
      const v = $('#shLink', m).value;
      try { await navigator.clipboard.writeText(v); aviso('Link copiado.'); } catch { $('#shLink', m).select(); document.execCommand('copy'); aviso('Link copiado.'); }
    };
    const env = $('#shEnviar', m); if (env) env.onclick = () => navigator.share({ title: titulo, url: $('#shLink', m).value }).catch(() => {});
    $('#shNovo', m).onclick = async () => {
      if (!(await confirmar('Gerar novo link', 'O link atual deixa de funcionar. Quem já tem o link antigo perde o acesso.', 'Gerar novo'))) return;
      if (await gravar({ compartilhada: true, link_token: novoId() })) aviso('Novo link gerado.');
    };
    pintar();
  });
}

/* ---------- acessos (só o administrador) ---------- */
async function abrirAcessos(){
  const r = await sb.from('usuarios').select('user_id,nome,email,aprovado,admin,criado_em').order('criado_em');
  if (r.error) return aviso('Não consegui ler os acessos: ' + r.error.message, 5000);
  modal(`<h2>Acessos</h2><div id="lsAc"></div><div class="acoes"><button class="bt pri" data-x>Fechar</button></div>`, (m, fechar) => {
    $('[data-x]', m).onclick = fechar;
    const pintar = lista => {
      $('#lsAc', m).innerHTML = lista.map(u => `<div class="linha-aj"><div class="tx"><b>${esc(u.nome || '—')}</b><small>${esc(u.email)}</small></div>
        ${u.admin ? '<span class="selo ok">administrador</span>' : `<span class="selo ${u.aprovado ? 'ok' : ''}">${u.aprovado ? 'autorizado' : 'aguardando'}</span>
        <button class="bt" data-u="${u.user_id}" data-v="${u.aprovado ? 0 : 1}">${u.aprovado ? 'Revogar' : 'Autorizar'}</button>`}</div>`).join('') || '<div class="vazio-lista">Ninguém ainda.</div>';
      m.querySelectorAll('[data-u]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        const x = await sb.rpc('definir_aprovado', { p_user: b.dataset.u, p_aprovado: b.dataset.v === '1' });
        if (x.error){ b.disabled = false; return aviso('Erro: ' + x.error.message, 5000); }
        const u = lista.find(y => y.user_id === b.dataset.u); u.aprovado = b.dataset.v === '1'; pintar(lista);
      });
    };
    pintar(r.data);
  });
}

/* =====================================================================
   EDITOR
   ===================================================================== */
let raizEditor = null, editorAtual = null;
async function abrirCena(id, tituloNovo){
  let cena;
  if (id){
    aviso('Abrindo…', 1200);
    cena = await lerCena(id);
    if (!cena) return aviso('Essa cena não está neste aparelho e não há internet para buscá-la.', 5000);
  } else cena = { id: novoId(), titulo: tituloNovo || 'Sem título', dados: null, nova: true, pasta_id: ehUuid(pastaAtual) ? pastaAtual : null };
  $('#telaCenas').classList.add('oculto');
  const t = $('#telaEditor'); t.classList.remove('oculto');
  if (!raizEditor) raizEditor = createRoot(t);
  raizEditor.render(<Editor key={cena.id} cena={cena} />);
}
async function fecharEditor(){
  if (editorAtual) await editorAtual.salvarAgora(true);
  editorAtual = null;
  if (raizEditor){ raizEditor.render(null); }
  mostrarCenas();
}

/* ---------- réguas ---------- */
function passoRegua(zoom){
  const alvo = 80 / zoom, mag = Math.pow(10, Math.floor(Math.log10(alvo)));
  const base = [1, 2, 5, 10].find(m => m * mag >= alvo) * mag;
  return { passo: base, sub: base / ((base / mag) === 2 ? 4 : 5) };
}
function desenharRegua(cv, horizontal, vista, ponteiro){
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)){ cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement);
  const corTx = css.getPropertyValue('--regua-tx').trim() || '#777', corRisco = css.getPropertyValue('--regua-risco').trim() || '#aaa';
  const { scrollX, scrollY, zoom } = vista, scroll = horizontal ? scrollX : scrollY, comp = horizontal ? w : h;
  const { passo, sub } = passoRegua(zoom);
  const ini = Math.floor((-scroll) / sub) * sub, fim = comp / zoom - scroll;
  g.strokeStyle = corRisco; g.fillStyle = corTx; g.font = '9px -apple-system,Segoe UI,sans-serif'; g.lineWidth = 1;
  g.beginPath();
  for (let v = ini; v <= fim + sub; v += sub){
    const p = Math.round((v + scroll) * zoom) + .5;
    const maior = Math.abs(v / passo - Math.round(v / passo)) < 1e-6;
    const tam = maior ? 10 : 4;
    if (horizontal){ g.moveTo(p, h); g.lineTo(p, h - tam); } else { g.moveTo(w, p); g.lineTo(w - tam, p); }
    if (maior){
      const rot = String(Math.round(v));
      if (horizontal) g.fillText(rot, p + 3, 9);
      else { g.save(); g.translate(9, p - 3); g.rotate(-Math.PI / 2); g.fillText(rot, 0, 0); g.restore(); }
    }
  }
  g.stroke();
  if (ponteiro){
    const p = ((horizontal ? ponteiro.x : ponteiro.y) + scroll) * zoom;
    g.strokeStyle = '#C9A227'; g.lineWidth = 2; g.beginPath();
    if (horizontal){ g.moveTo(p, 0); g.lineTo(p, h); } else { g.moveTo(0, p); g.lineTo(w, p); }
    g.stroke();
  }
}

/* ---------- o componente do editor ---------- */
function Editor({ cena }){
  const [api, setApi] = useState(null);
  const [temaEd, setTemaEd] = useState(tema);
  const [pontilhado, setPontilhado] = useState(lerLS('tb.pontilhado', true));
  const [reguas, setReguas] = useState(lerLS('tb.reguas', true));
  const [status, setStatus] = useState('ok');
  const [titulo, setTitulo] = useState(cena.titulo || 'Sem título');
  const [apresentando, setApresentando] = useState(false);
  const [idx, setIdx] = useState(0);
  const [laser, setLaser] = useState(false);
  const ref = useRef({ cena: { ...cena }, assinatura: null, alterado: false, tSalvar: null, ultimaMini: 0, salvando: null, vista: { scrollX: 0, scrollY: 0, zoom: 1 }, ponteiro: null, raf: 0,
    slides: (cena.dados && cena.dados.tabula && cena.dados.tabula.slides) || [], idx: 0, apresentando: false });
  const rH = useRef(null), rV = useRef(null), rPontos = useRef(null), palco = useRef(null), rMascara = useRef(null);
  const st = ref.current;

  useEffect(() => api ? ativarCoresAmpliadas(() => api) : undefined, [api]);

  useHandleLibrary({ excalidrawAPI: api, adapter: bibliotecaAdapter });

  useEffect(() => { const f = t => setTemaEd(t); ouvintesTema.add(f); return () => ouvintesTema.delete(f); }, []);
  useEffect(() => gravarLS('tb.pontilhado', pontilhado), [pontilhado]);
  useEffect(() => gravarLS('tb.reguas', reguas), [reguas]);

  /* desenha réguas e pontos conforme a rolagem e o zoom */
  const redesenhar = useCallback(() => {
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(() => {
      const v = st.vista;
      if (st.apresentando && rMascara.current){
        const q = quadrosOrdenados(api, st.slides)[st.idx], m = rMascara.current;
        if (q){ m.style.left = (q.x + v.scrollX) * v.zoom + 'px'; m.style.top = (q.y + v.scrollY) * v.zoom + 'px'; m.style.width = q.width * v.zoom + 'px'; m.style.height = q.height * v.zoom + 'px'; }
      }
      if (reguas && !st.apresentando){ desenharRegua(rH.current, true, v, st.ponteiro); desenharRegua(rV.current, false, v, st.ponteiro); }
      const p = rPontos.current;
      if (p){
        let gap = 20 * v.zoom; while (gap < 10) gap *= 2;
        const ox = ((v.scrollX * v.zoom) % gap + gap) % gap, oy = ((v.scrollY * v.zoom) % gap + gap) % gap;
        const r = Math.max(.8, Math.min(1.6, v.zoom * 1.1));
        p.style.backgroundImage = `radial-gradient(circle, var(--pontos) ${r}px, transparent ${r + .4}px)`;
        p.style.backgroundSize = `${gap}px ${gap}px`;
        p.style.backgroundPosition = `${ox - gap / 2}px ${oy - gap / 2}px`;
      }
    });
  }, [reguas, st, api]);
  useEffect(() => { redesenhar(); }, [reguas, pontilhado, temaEd, redesenhar]);
  useEffect(() => { const ro = new ResizeObserver(() => redesenhar()); palco.current && ro.observe(palco.current); return () => ro.disconnect(); }, [redesenhar]);

  /* camada de pontos fica entre o desenho e os botões do editor */
  useEffect(() => {
    if (!api || !pontilhado || apresentando){ rPontos.current && rPontos.current.remove(); rPontos.current = null; return; }
    const tentar = () => {
      const cv = palco.current && palco.current.querySelector('canvas.excalidraw__canvas.interactive');
      if (!cv) return setTimeout(tentar, 120);
      const d = document.createElement('div'); d.className = 'pontos';
      cv.insertAdjacentElement('afterend', d); rPontos.current = d; redesenhar();
    };
    tentar();
    return () => { rPontos.current && rPontos.current.remove(); rPontos.current = null; };
  }, [api, pontilhado, apresentando, redesenhar]);

  /* ---------- salvar ---------- */
  const salvarAgora = useCallback(async (comMiniatura) => {
    clearTimeout(st.tSalvar);
    if (!api || !st.alterado){ return; }
    if (st.salvando){ await st.salvando; if (!st.alterado) return; }
    st.alterado = false;
    const run = (async () => {
      setStatus('salvando');
      const elementos = api.getSceneElements(), appState = api.getAppState(), todos = api.getFiles();
      const usados = {}; elementos.forEach(e => { if (e.fileId && todos[e.fileId]) usados[e.fileId] = todos[e.fileId]; });
      const dados = JSON.parse(serializeAsJSON(elementos, appState, usados, 'local'));
      dados.tabula = { slides: st.slides };                                    // ordem dos slides (quadros)
      const c = st.cena; c.dados = dados; c.titulo = st.titulo || c.titulo; c.atualizado_em = agora();
      if (comMiniatura || Date.now() - st.ultimaMini > 20000){
        st.ultimaMini = Date.now();
        try {
          if (!elementos.length) c.miniatura = null;
          else {
            const b = await exportToBlob({ elements: elementos, appState: { ...appState, exportBackground: true, exportWithDarkMode: false }, files: usados, maxWidthOrHeight: 420, mimeType: 'image/jpeg', quality: .72 });
            c.miniatura = await blobParaDataURL(b);
          }
        } catch (e) { console.warn('miniatura', e); }
      }
      const r = await gravarCena({ ...c });
      delete c.nova;
      setStatus(r === 'ok' ? (st.alterado ? 'salvando' : 'ok') : r);
    })();
    st.salvando = run; await run; st.salvando = null;
  }, [api, st]);
  useEffect(() => { editorAtual = { salvarAgora }; }, [salvarAgora]);
  useEffect(() => {
    const oculto = () => { if (document.visibilityState === 'hidden') salvarAgora(true); };
    document.addEventListener('visibilitychange', oculto);
    window.addEventListener('pagehide', oculto);
    return () => { document.removeEventListener('visibilitychange', oculto); window.removeEventListener('pagehide', oculto); };
  }, [salvarAgora]);

  const aoMudar = useCallback((elementos, appState, files) => {
    st.vista = { scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom.value }; redesenhar();
    const ass = hashElementsVersion(elementos) + '|' + appState.viewBackgroundColor + '|' + Object.keys(files).length;
    if (st.assinatura === null){ st.assinatura = ass; return; }      // primeira leitura (cena recém-aberta)
    if (ass === st.assinatura) return;
    st.assinatura = ass; st.alterado = true; setStatus('pend-local');
    clearTimeout(st.tSalvar); st.tSalvar = setTimeout(() => salvarAgora(false), 1500);
  }, [redesenhar, salvarAgora, st]);

  const marcarAlterado = () => { st.alterado = true; setStatus('pend-local'); clearTimeout(st.tSalvar); st.tSalvar = setTimeout(() => salvarAgora(false), 1200); };

  /* ---------- apresentação: cada quadro é um slide ---------- */
  const enquadrar = useCallback((animar = true) => {
    const q = quadrosOrdenados(api, st.slides)[st.idx]; if (!q) return;
    api.scrollToContent(q, { fitToViewport: true, viewportZoomFactor: 1, animate: animar, duration: 350 });
    setTimeout(redesenhar, animar ? 380 : 30);
  }, [api, st, redesenhar]);
  const irPara = useCallback(i => {
    const n = quadrosOrdenados(api, st.slides).length; if (!n) return;
    st.idx = limitarN(i, 0, n - 1); setIdx(st.idx); enquadrar(true);
  }, [api, st, enquadrar]);
  const iniciarApresentacao = useCallback((i = 0) => {
    const qs = quadrosOrdenados(api, st.slides);
    if (!qs.length) return aviso('Para apresentar, crie quadros com a ferramenta Quadro (tecla F, no menu ⋯ da barra). Cada quadro vira um slide.', 8000);
    document.querySelectorAll('.fundo-modal').forEach(x => x.remove());
    st.idx = limitarN(i, 0, qs.length - 1); setIdx(st.idx);
    st.frAntes = api.getAppState().frameRendering;
    api.updateScene({ appState: { frameRendering: { ...st.frAntes, enabled: true, name: false, outline: false, clip: true }, selectedElementIds: {} } });
    st.apresentando = true; setApresentando(true); setLaser(false);
    const el = $('#telaEditor');
    try { const pr = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (pr && pr.catch) pr.catch(() => {}); } catch {}
    setTimeout(() => enquadrar(false), 120); setTimeout(() => enquadrar(false), 600);
  }, [api, st, enquadrar]);
  const sairApresentacao = useCallback(() => {
    if (!st.apresentando) return;
    st.apresentando = false; setApresentando(false); setLaser(false);
    try { api.updateScene({ appState: { frameRendering: st.frAntes } }); api.setActiveTool({ type: 'selection' }); } catch {}
    const fe = document.fullscreenElement || document.webkitFullscreenElement;
    if (fe){ try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {} }
    setTimeout(redesenhar, 200);
  }, [api, st, redesenhar]);
  useEffect(() => {
    if (!apresentando) return;
    const tecla = e => {
      const k = e.key;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)){ e.preventDefault(); e.stopPropagation(); irPara(st.idx + 1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)){ e.preventDefault(); e.stopPropagation(); irPara(st.idx - 1); }
      else if (k === 'Home'){ e.preventDefault(); irPara(0); }
      else if (k === 'End'){ e.preventDefault(); irPara(1e9); }
      else if (k === 'Escape'){ e.preventDefault(); e.stopPropagation(); sairApresentacao(); }
    };
    const tela = () => { if (!(document.fullscreenElement || document.webkitFullscreenElement) && st.estavaCheia) sairApresentacao(); st.estavaCheia = !!(document.fullscreenElement || document.webkitFullscreenElement); };
    const tam = () => setTimeout(() => enquadrar(false), 150);
    window.addEventListener('keydown', tecla, true);
    document.addEventListener('fullscreenchange', tela); document.addEventListener('webkitfullscreenchange', tela);
    window.addEventListener('resize', tam);
    return () => { window.removeEventListener('keydown', tecla, true); document.removeEventListener('fullscreenchange', tela); document.removeEventListener('webkitfullscreenchange', tela); window.removeEventListener('resize', tam); st.estavaCheia = false; };
  }, [apresentando, irPara, sairApresentacao, enquadrar, st]);
  const alternarLaser = () => { const novo = !laser; setLaser(novo); try { api.setActiveTool({ type: novo ? 'laser' : 'hand' }); } catch {} };

  /* ---------- painel de slides (ordem, nomes, miniaturas) ---------- */
  const abrirSlides = () => {
    if (!api) return;
    const cache = new Map();
    modal(`<h2>Slides</h2><p class="dica">Cada <b>quadro</b> da cena é um slide (ferramenta Quadro, tecla F). Arrume a ordem aqui.</p>
      <div id="lsSl"></div>
      <div class="acoes"><button class="bt" data-x>Fechar</button><button class="bt pri" id="slAp">▶ Apresentar</button></div>`, (m, fechar) => {
      $('[data-x]', m).onclick = fechar;
      $('#slAp', m).onclick = () => { fechar(); iniciarApresentacao(0); };
      const pintar = () => {
        const qs = quadrosOrdenados(api, st.slides);
        const novaOrdem = qs.map(q => q.id);
        if (novaOrdem.join() !== st.slides.join()){ st.slides = novaOrdem; }
        $('#lsSl', m).innerHTML = qs.length ? qs.map((q, i) => `<div class="sl-item" data-id="${q.id}">
            <span class="sl-n">${i + 1}</span><img class="sl-mini" alt="">
            <div class="sl-tx"><b>${esc(nomeQuadro(q, i))}</b><small>${Math.round(q.width)} × ${Math.round(q.height)}</small></div>
            <div class="sl-bts"><button class="bt" data-a="up" title="Subir" ${i ? '' : 'disabled'}>↑</button><button class="bt" data-a="dn" title="Descer" ${i < qs.length - 1 ? '' : 'disabled'}>↓</button>
            <button class="bt" data-a="ren" title="Renomear">✎</button><button class="bt" data-a="ir" title="Ver no quadro">Ir</button><button class="bt" data-a="ap" title="Apresentar a partir daqui">▶</button></div></div>`).join('')
          : '<div class="vazio-lista">Nenhum quadro nesta cena ainda.<br>Use a ferramenta <b>Quadro</b> (tecla F) e desenhe um retângulo: tudo o que ficar dentro dele forma um slide.</div>';
        qs.forEach(async q => {
          const chave = q.id + ':' + q.version + ':' + hashElementsVersion(api.getSceneElements());
          let url = cache.get(chave);
          if (!url){ try { url = (await imagemDoQuadro(api, q, 240)).url; cache.set(chave, url); } catch { return; } }
          const img = m.querySelector(`.sl-item[data-id="${q.id}"] .sl-mini`); if (img) img.src = url;
        });
        m.querySelectorAll('.sl-item').forEach(el => el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
          const id = el.dataset.id, i = st.slides.indexOf(id), a = b.dataset.a;
          if (a === 'up' || a === 'dn'){
            const j = a === 'up' ? i - 1 : i + 1; const o = [...st.slides]; [o[i], o[j]] = [o[j], o[i]]; st.slides = o; marcarAlterado(); pintar();
          } else if (a === 'ren'){
            const q = api.getSceneElements().find(x => x.id === id);
            const nome = await pedirTexto('Nome do slide', nomeQuadro(q, i)); if (!nome) return;
            api.updateScene({ elements: api.getSceneElementsIncludingDeleted().map(x => x.id === id ? newElementWith(x, { name: nome }) : x) });
            setTimeout(pintar, 50);
          } else if (a === 'ir'){
            fechar(); const q = api.getSceneElements().find(x => x.id === id);
            api.scrollToContent(q, { fitToViewport: true, viewportZoomFactor: .9, animate: true });
          } else if (a === 'ap'){ fechar(); iniciarApresentacao(i); }
        }));
      };
      pintar();
    });
  };

  /* ---------- exportar PDF / PowerPoint ---------- */
  const exportar = async tipo => {
    if (!api) return;
    const n = quadrosOrdenados(api, st.slides).length;
    if (!n && !(await confirmar('Sem quadros', 'Esta cena não tem quadros (slides). Exportar o desenho inteiro numa página só?', 'Exportar assim'))) return;
    try {
      const f = tipo === 'PDF' ? exportarPDF : exportarPPTX;
      const r = await f(api, st.slides, st.titulo || titulo, (i, t) => aviso(`Gerando ${tipo}… slide ${i} de ${t}`, 0));
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (ios) aviso(`${tipo} pronto (${r.paginas} ${r.paginas > 1 ? 'slides' : 'slide'}).`, 0, { rotulo: 'Salvar / Enviar', fazer: () => entregarArquivo(r.blob, r.nome) });
      else { await entregarArquivo(r.blob, r.nome); aviso(`${tipo} pronto: ${r.nome}`, 4000); }
    } catch (e) { console.error(e); aviso('Não consegui gerar o ' + tipo + ': ' + (e.message || e), 7000); }
  };

  /* ---------- IA: texto → diagrama e rascunho de tela → página ---------- */
  const textoParaDiagrama = useCallback(async texto => {
    try {
      const d = await chamarIA('/diagrama', { texto });
      // o conversor do editor não entende <br>: vira espaço, e a caixa quebra a linha sozinha
      const m = String(d.mermaid || '').replace(/<br\s*\/?>/gi, ' ').replace(/ {2,}/g, ' ');
      return { generatedResponse: m };
    }
    catch (e) { return { error: e instanceof Error ? e : new Error(String(e)) }; }
  }, []);
  const rascunhoParaCodigo = useCallback(async ({ frame, children }) => {
    const b = await exportToBlob({ elements: children, appState: { exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
      files: api ? api.getFiles() : {}, exportingFrame: frame, mimeType: 'image/png', maxWidthOrHeight: 1200 });
    const imagem = await blobParaDataURL(b);
    const textos = children.filter(e => e.type === 'text').map(e => e.text);
    const d = await chamarIA('/codigo', { imagem, textos });
    return { html: d.html };
  }, [api]);

  const mudarTitulo = v => { setTitulo(v); st.titulo = v; st.alterado = true; clearTimeout(st.tSalvar); st.tSalvar = setTimeout(() => salvarAgora(false), 1200); };

  const iniciais = useRef(cena.dados ? { ...cena.dados, appState: { ...(cena.dados.appState || {}) }, scrollToContent: !(cena.dados.appState && cena.dados.appState.scrollX !== undefined) } : { appState: { viewBackgroundColor: '#ffffff' } }).current;
  st.titulo = st.titulo ?? titulo;

  const corStatus = { ok: '', salvando: 'salvando', 'pend-local': 'salvando', pend: 'pend', erro: 'erro' }[status] || '';
  const textoStatus = { ok: 'Salvo na nuvem', salvando: 'Salvando…', 'pend-local': 'Salvando…', pend: 'Sem internet — guardado no aparelho', erro: 'Erro ao salvar na nuvem (guardado no aparelho)' }[status];

  const topoDireita = (isMobile) => (
    <div className="tb-topo">
      <button className="tb-bt" title="Voltar às cenas" onClick={fecharEditor}><IcR d={D_VOLTAR} />{!isMobile && <span className="tb-rot">Cenas</span>}</button>
      {!isMobile && <input className="tb-titulo" value={titulo} onChange={e => mudarTitulo(e.target.value)} title="Nome da cena" />}
      <button className="tb-bt" title="Slides (ordem dos quadros)" onClick={abrirSlides}><IcR d={D_SLIDES} /></button>
      <button className="tb-bt tb-play" title="Apresentar" onClick={() => iniciarApresentacao(0)}><IcR d={D_PLAY} />{!isMobile && 'Apresentar'}</button>
      <button className="tb-bt" title="Compartilhar link" onClick={async () => { await salvarAgora(true); abrirCompartilhar(st.cena.id, st.titulo || titulo); }}><IcR d={D_LINK} /></button>
      <span className={'tb-st ' + corStatus} title={textoStatus}></span>
      <button className="tb-bt" title={temaEd === 'escuro' ? 'Modo claro' : 'Modo escuro'} onClick={trocarTema}><IcR d={temaEd === 'escuro' ? D_SOL : D_LUA} /></button>
      <span className="tb-ver">v{VERSAO}</span>
    </div>
  );

  return (
    <>
      {reguas && !apresentando && <>
        <div className="regua-canto">px</div>
        <canvas className="regua h" ref={rH} style={{ width: 'calc(100% - 20px)' }} />
        <canvas className="regua v" ref={rV} style={{ height: 'calc(100% - 20px)' }} />
      </>}
      <div ref={palco} className={'ed-palco' + (reguas && !apresentando ? ' com-reguas' : '') + (apresentando ? ' apresentando' : '')} style={reguas && !apresentando ? { width: 'calc(100% - 20px)', height: 'calc(100% - 20px)' } : null}>
        {apresentando && <div className="mascara-slide" ref={rMascara} />}
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={iniciais}
          onChange={aoMudar}
          onScrollChange={(x, y, z) => { st.vista = { scrollX: x, scrollY: y, zoom: z.value }; redesenhar(); }}
          onPointerUpdate={p => { if (reguas){ st.ponteiro = p.pointer; redesenhar(); } }}
          langCode="pt-BR"
          theme={temaEd === 'escuro' ? 'dark' : 'light'}
          name={titulo}
          renderTopRightUI={topoDireita}
          UIOptions={{ canvasActions: { toggleTheme: false } }}
          viewModeEnabled={apresentando}
          aiEnabled={true}
        >
          <TTDDialogTrigger />
          <TTDDialog onTextSubmit={textoParaDiagrama} />
          <DiagramToCodePlugin generate={rascunhoParaCodigo} />
          <MainMenu>
            <MainMenu.Item onSelect={fecharEditor}>← Voltar às cenas</MainMenu.Item>
            <MainMenu.Item onSelect={async () => { const t = await pedirTexto('Nome da cena', titulo); if (t) mudarTitulo(t); }}>Renomear cena</MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.Item onSelect={() => iniciarApresentacao(0)}>▶ Apresentar</MainMenu.Item>
            <MainMenu.Item onSelect={abrirSlides}>Slides (ordem dos quadros)</MainMenu.Item>
            <MainMenu.Item onSelect={() => exportar('PDF')}>Exportar PDF</MainMenu.Item>
            <MainMenu.Item onSelect={() => exportar('PowerPoint')}>Exportar PowerPoint (PPTX)</MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.DefaultItems.SaveToActiveFile />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.Separator />
            <MainMenu.Item onSelect={() => setPontilhado(v => !v)}>{pontilhado ? '☑' : '☐'} Fundo pontilhado</MainMenu.Item>
            <MainMenu.Item onSelect={() => setReguas(v => !v)}>{reguas ? '☑' : '☐'} Réguas nas margens</MainMenu.Item>
            <MainMenu.Item onSelect={trocarTema}>{temaEd === 'escuro' ? '☀ Modo claro' : '☾ Modo escuro'}</MainMenu.Item>
            <MainMenu.DefaultItems.ChangeCanvasBackground />
            <MainMenu.Separator />
            <MainMenu.Item onSelect={configurarIA}>Assistente de IA…</MainMenu.Item>
            <MainMenu.Item onSelect={() => verificarVersao(true)}>Verificar atualização (v{VERSAO})</MainMenu.Item>
            <MainMenu.Item onSelect={atualizarApp}>Atualizar app agora</MainMenu.Item>
          </MainMenu>
          <WelcomeScreen>
            <WelcomeScreen.Hints.MenuHint>Menu, exportar, réguas e pontilhado</WelcomeScreen.Hints.MenuHint>
            <WelcomeScreen.Hints.ToolbarHint>Escolha uma ferramenta e comece a desenhar</WelcomeScreen.Hints.ToolbarHint>
            <WelcomeScreen.Hints.HelpHint />
            <WelcomeScreen.Center>
              <WelcomeScreen.Center.Logo><span className="tb-logo">{NOME_APP}</span></WelcomeScreen.Center.Logo>
              <WelcomeScreen.Center.Heading>Tudo o que você desenhar aqui fica salvo na nuvem.</WelcomeScreen.Center.Heading>
              <WelcomeScreen.Center.Menu>
                <WelcomeScreen.Center.MenuItemLoadScene />
                <WelcomeScreen.Center.MenuItemHelp />
              </WelcomeScreen.Center.Menu>
            </WelcomeScreen.Center>
          </WelcomeScreen>
        </Excalidraw>
      </div>
      {apresentando && (() => { const n = quadrosOrdenados(api, st.slides).length; return (
        <div className="ap-controles">
          <button onClick={() => irPara(st.idx - 1)} disabled={idx <= 0} title="Anterior (←)"><IcR d={D_ANT} /></button>
          <span className="ap-n">{idx + 1} / {n}</span>
          <button onClick={() => irPara(st.idx + 1)} disabled={idx >= n - 1} title="Próximo (→)"><IcR d={D_PROX} /></button>
          <span className="ap-sep" />
          <button className={laser ? 'ativo' : ''} onClick={alternarLaser} title="Apontador laser"><IcR d={D_LASER} /></button>
          <button onClick={sairApresentacao} title="Sair (Esc)"><IcR d={D_X} /></button>
        </div>); })()}
    </>
  );
}

/* =====================================================================
   VISUALIZADOR — quem recebe o link só vê (não precisa de conta)
   ===================================================================== */
async function buscarCenaPublica(token){
  const r = await sb.rpc('cena_publica', { p_token: token });
  if (r.error) throw r.error;
  return Array.isArray(r.data) ? r.data[0] : r.data;
}
async function mostrarVisualizador(token){
  let cena = null;
  try { cena = await buscarCenaPublica(token); }
  catch (e) {
    return telaMensagem('Não consegui abrir', navigator.onLine ? 'O desenho não pôde ser carregado agora. Tente de novo em instantes.' : 'Sem internet. Conecte-se para ver o desenho.',
      [{ rotulo: 'Tentar de novo', pri: true, fazer: () => mostrarVisualizador(token) }]);
  }
  if (!cena) return telaMensagem('Link indisponível', 'Este link foi desligado por quem compartilhou, ou não existe.');
  document.title = (cena.titulo || 'Desenho') + ' · ' + NOME_APP;
  $('#telaCenas').classList.add('oculto');
  const t = $('#telaEditor'); t.classList.remove('oculto');
  createRoot(t).render(<Visualizador cena={cena} token={token} />);
}
function Visualizador({ cena, token }){
  const [api, setApi] = useState(null);
  const [temaV, setTemaV] = useState(tema);
  const [quando, setQuando] = useState(cena.atualizado_em);
  useEffect(() => { const f = x => setTemaV(x); ouvintesTema.add(f); return () => ouvintesTema.delete(f); }, []);
  const dados = cena.dados || {};
  const iniciais = useRef({ elements: dados.elements || [], files: dados.files || {}, appState: { viewBackgroundColor: (dados.appState && dados.appState.viewBackgroundColor) || '#ffffff' }, scrollToContent: true }).current;
  const recarregar = async () => {
    try {
      const c = await buscarCenaPublica(token);
      if (!c) return aviso('Este link foi desligado.', 5000);
      const d = c.dados || {};
      if (d.files) api.addFiles(Object.values(d.files));
      api.updateScene({ elements: d.elements || [], appState: { viewBackgroundColor: (d.appState && d.appState.viewBackgroundColor) || '#ffffff' } });
      setQuando(c.atualizado_em); aviso('Desenho atualizado.');
    } catch { aviso('Não consegui atualizar agora.'); }
  };
  return (
    <div className="ed-palco">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={iniciais}
        viewModeEnabled={true}
        langCode="pt-BR"
        theme={temaV === 'escuro' ? 'dark' : 'light'}
        name={cena.titulo || 'Desenho'}
        UIOptions={{ canvasActions: { toggleTheme: false, loadScene: false, saveToActiveFile: false, clearCanvas: false, changeViewBackgroundColor: false } }}
        renderTopRightUI={(isMobile) => (
          <div className="tb-topo">
            {!isMobile && <span className="tb-bt tb-somente" title={'Atualizado em ' + dataCurta(quando)}>{cena.titulo || 'Desenho'} · só visualização</span>}
            <button className="tb-bt" title="Ver a versão mais recente" onClick={recarregar}><IcR d={D_RECARREGAR} /></button>
            <button className="tb-bt" title={temaV === 'escuro' ? 'Modo claro' : 'Modo escuro'} onClick={trocarTema}><IcR d={temaV === 'escuro' ? D_SOL : D_LUA} /></button>
            <span className="tb-ver">v{VERSAO}</span>
          </div>
        )}
      >
        <MainMenu>
          <MainMenu.Item onSelect={recarregar}>Ver a versão mais recente</MainMenu.Item>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.Separator />
          <MainMenu.Item onSelect={trocarTema}>{temaV === 'escuro' ? '☀ Modo claro' : '☾ Modo escuro'}</MainMenu.Item>
          <MainMenu.Item onSelect={() => verificarVersao(true)}>Verificar atualização (v{VERSAO})</MainMenu.Item>
          <MainMenu.Item onSelect={atualizarApp}>Atualizar app agora</MainMenu.Item>
        </MainMenu>
      </Excalidraw>
    </div>
  );
}

/* =====================================================================
   INÍCIO
   ===================================================================== */
async function iniciar(){
  aplicarTema(tema);
  const tokenVer = new URLSearchParams(location.search).get('ver');
  if (tokenVer){ await mostrarVisualizador(tokenVer); setTimeout(verificarVersao, 5000); return; }
  let sess = null;
  try { const r = await sb.auth.getSession(); sess = r.data && r.data.session; } catch {}
  if (sess) await entrar(sess.user);
  else if (!navigator.onLine && lerLS('tb.uid', null) && perfil){ usuario = { id: lerLS('tb.uid'), email: '' }; mostrarCenas(); }
  else mostrarLogin();
  setTimeout(verificarVersao, 5000);
  setInterval(verificarVersao, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible'){ verificarVersao(); enviarPendentes(); } });
}
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
iniciar();
