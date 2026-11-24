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
  useHandleLibrary, hashElementsVersion,
} from '@excalidraw/excalidraw';
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
};
const IcR = ({ d }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />;
const D_VOLTAR = '<path d="M15 18l-6-6 6-6"/>';
const D_SOL = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const D_LUA = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';

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
async function listarCenas(){
  let lista = (await IDB.ler('lista')) || [];
  if (navigator.onLine && usuario){
    const r = await sb.from('cenas').select(COLS_LISTA).eq('apagado', false).order('atualizado_em', { ascending: false });
    if (!r.error){ lista = r.data; await IDB.gravar('lista', lista); }
  }
  // cenas salvas só no aparelho (sem internet) aparecem também
  for (const k of await IDB.chaves()){
    if (!String(k).startsWith('pend:')) continue;
    const c = await IDB.ler(k); if (!c) continue;
    const i = lista.findIndex(x => x.id === c.id), resumo = { id: c.id, titulo: c.titulo, miniatura: c.miniatura, atualizado_em: c.atualizado_em };
    if (i < 0) lista.unshift(resumo); else if (c.atualizado_em > lista[i].atualizado_em) lista[i] = resumo;
  }
  return lista.sort((a, b) => (b.atualizado_em || '').localeCompare(a.atualizado_em || ''));
}
async function lerCena(id){
  const local = await IDB.ler('cena:' + id), pend = await IDB.ler('pend:' + id);
  if (pend) return pend;                               // alteração ainda não enviada vence
  if (navigator.onLine){
    const r = await sb.from('cenas').select('id,titulo,dados,miniatura,atualizado_em').eq('id', id).maybeSingle();
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
   TELA DAS CENAS
   ===================================================================== */
let filtro = '', listaAtual = [];
function mostrarCenas(){
  const t = $('#telaCenas'); t.classList.remove('oculto'); $('#telaEditor').classList.add('oculto');
  t.innerHTML = `<div class="barra"><span class="marca">${NOME_APP}</span><span class="versao">v${VERSAO}</span><span class="esp"></span>
    <input class="busca" placeholder="Buscar cena…" value="${esc(filtro)}">
    <button class="bt-ouro" id="btNova">+ Nova cena</button>
    <button class="bt-ic" data-bt-tema></button>
    <button class="bt-ic" id="btAtualizar" title="Atualizar app">${I.atualizar}</button>
    <button class="bt-ic" id="btMenu" title="Ajustes">${I.menu}</button></div>
    <div class="rolagem"><div class="titulo-sec">Minhas cenas</div><div class="grade" id="grade"></div></div>`;
  $('[data-bt-tema]', t).onclick = trocarTema; aplicarTema(tema);
  $('#btNova', t).onclick = novaCena;
  $('#btAtualizar', t).onclick = atualizarApp;
  $('#btMenu', t).onclick = e => menuFlutuante(e.currentTarget, [
    { info: `${perfil && perfil.nome || ''} · ${usuario && usuario.email || ''}` },
    { info: `${NOME_APP} · v${VERSAO}` },
    { rotulo: 'Verificar atualização', fazer: () => verificarVersao(true) },
    { rotulo: 'Atualizar app agora', fazer: atualizarApp },
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
  desenharGrade();
}
function desenharGrade(){
  const g = $('#grade'); if (!g) return;
  const f = filtro.trim().toLowerCase();
  const itens = listaAtual.filter(c => !f || (c.titulo || '').toLowerCase().includes(f));
  g.innerHTML = `<div class="cartao nova" id="cNova">${I.novo}<span>Nova cena</span></div>` + itens.map(c => `
    <div class="cartao" data-id="${c.id}">
      <div class="mini">${c.miniatura ? `<img src="${c.miniatura}" alt="">` : '<span class="vazio">em branco</span>'}</div>
      <div class="info"><div style="flex:1;min-width:0"><div class="nome">${esc(c.titulo || 'Sem título')}</div><div class="data">${dataCurta(c.atualizado_em)}</div></div>
      <button class="mais" data-mais="${c.id}" title="Opções">${I.mais}</button></div>
    </div>`).join('') + (f && !itens.length ? '<div class="vazio-lista">Nenhuma cena com esse nome.</div>' : '');
  $('#cNova', g).onclick = novaCena;
  g.querySelectorAll('.cartao[data-id]').forEach(el => el.onclick = e => { if (e.target.closest('[data-mais]')) return; abrirCena(el.dataset.id); });
  g.querySelectorAll('[data-mais]').forEach(b => b.onclick = e => {
    e.stopPropagation(); const id = b.dataset.mais, c = listaAtual.find(x => x.id === id);
    menuFlutuante(b, [
      { rotulo: 'Abrir', fazer: () => abrirCena(id) },
      { rotulo: 'Renomear', fazer: () => renomearCena(c) },
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
  const nova = { id: novoId(), titulo: (cena.titulo || 'Sem título') + ' (cópia)', dados: cena.dados, miniatura: cena.miniatura || null, atualizado_em: agora() };
  await gravarCena(nova); aviso('Cena duplicada.'); pintarCenas();
}
async function apagarCena(c){
  if (!(await confirmar('Apagar cena', `Apagar “${c.titulo || 'Sem título'}”?`, 'Apagar', true))) return;
  if (!navigator.onLine) return aviso('Precisa de internet para apagar.');
  const r = await sb.from('cenas').update({ apagado: true, atualizado_em: agora() }).eq('id', c.id);
  if (r.error) return aviso('Não consegui apagar: ' + r.error.message, 5000);
  await IDB.apagar('cena:' + c.id); await IDB.apagar('pend:' + c.id);
  listaAtual = listaAtual.filter(x => x.id !== c.id); desenharGrade(); aviso('Cena apagada.');
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
  } else cena = { id: novoId(), titulo: tituloNovo || 'Sem título', dados: null, nova: true };
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
  const ref = useRef({ cena: { ...cena }, assinatura: null, alterado: false, tSalvar: null, ultimaMini: 0, salvando: null, vista: { scrollX: 0, scrollY: 0, zoom: 1 }, ponteiro: null, raf: 0 });
  const rH = useRef(null), rV = useRef(null), rPontos = useRef(null), palco = useRef(null);
  const st = ref.current;

  useHandleLibrary({ excalidrawAPI: api, adapter: bibliotecaAdapter });

  useEffect(() => { const f = t => setTemaEd(t); ouvintesTema.add(f); return () => ouvintesTema.delete(f); }, []);
  useEffect(() => gravarLS('tb.pontilhado', pontilhado), [pontilhado]);
  useEffect(() => gravarLS('tb.reguas', reguas), [reguas]);

  /* desenha réguas e pontos conforme a rolagem e o zoom */
  const redesenhar = useCallback(() => {
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(() => {
      const v = st.vista;
      if (reguas){ desenharRegua(rH.current, true, v, st.ponteiro); desenharRegua(rV.current, false, v, st.ponteiro); }
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
  }, [reguas, st]);
  useEffect(() => { redesenhar(); }, [reguas, pontilhado, temaEd, redesenhar]);
  useEffect(() => { const ro = new ResizeObserver(() => redesenhar()); palco.current && ro.observe(palco.current); return () => ro.disconnect(); }, [redesenhar]);

  /* camada de pontos fica entre o desenho e os botões do editor */
  useEffect(() => {
    if (!api || !pontilhado){ rPontos.current && rPontos.current.remove(); rPontos.current = null; return; }
    const tentar = () => {
      const cv = palco.current && palco.current.querySelector('canvas.excalidraw__canvas.interactive');
      if (!cv) return setTimeout(tentar, 120);
      const d = document.createElement('div'); d.className = 'pontos';
      cv.insertAdjacentElement('afterend', d); rPontos.current = d; redesenhar();
    };
    tentar();
    return () => { rPontos.current && rPontos.current.remove(); rPontos.current = null; };
  }, [api, pontilhado, redesenhar]);

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

  const mudarTitulo = v => { setTitulo(v); st.titulo = v; st.alterado = true; clearTimeout(st.tSalvar); st.tSalvar = setTimeout(() => salvarAgora(false), 1200); };

  const iniciais = useRef(cena.dados ? { ...cena.dados, appState: { ...(cena.dados.appState || {}) }, scrollToContent: !(cena.dados.appState && cena.dados.appState.scrollX !== undefined) } : { appState: { viewBackgroundColor: '#ffffff' } }).current;
  st.titulo = st.titulo ?? titulo;

  const corStatus = { ok: '', salvando: 'salvando', 'pend-local': 'salvando', pend: 'pend', erro: 'erro' }[status] || '';
  const textoStatus = { ok: 'Salvo na nuvem', salvando: 'Salvando…', 'pend-local': 'Salvando…', pend: 'Sem internet — guardado no aparelho', erro: 'Erro ao salvar na nuvem (guardado no aparelho)' }[status];

  const topoDireita = (isMobile) => (
    <div className="tb-topo">
      <button className="tb-bt" title="Voltar às cenas" onClick={fecharEditor}><IcR d={D_VOLTAR} />{!isMobile && 'Cenas'}</button>
      {!isMobile && <input className="tb-titulo" value={titulo} onChange={e => mudarTitulo(e.target.value)} title="Nome da cena" />}
      <span className={'tb-st ' + corStatus} title={textoStatus}></span>
      <button className="tb-bt" title={temaEd === 'escuro' ? 'Modo claro' : 'Modo escuro'} onClick={trocarTema}><IcR d={temaEd === 'escuro' ? D_SOL : D_LUA} /></button>
      <span className="tb-ver">v{VERSAO}</span>
    </div>
  );

  return (
    <>
      {reguas && <>
        <div className="regua-canto">px</div>
        <canvas className="regua h" ref={rH} style={{ width: 'calc(100% - 20px)' }} />
        <canvas className="regua v" ref={rV} style={{ height: 'calc(100% - 20px)' }} />
      </>}
      <div ref={palco} className={'ed-palco' + (reguas ? ' com-reguas' : '')} style={reguas ? { width: 'calc(100% - 20px)', height: 'calc(100% - 20px)' } : null}>
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
        >
          <MainMenu>
            <MainMenu.Item onSelect={fecharEditor}>← Voltar às cenas</MainMenu.Item>
            <MainMenu.Item onSelect={async () => { const t = await pedirTexto('Nome da cena', titulo); if (t) mudarTitulo(t); }}>Renomear cena</MainMenu.Item>
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
    </>
  );
}

/* =====================================================================
   INÍCIO
   ===================================================================== */
async function iniciar(){
  aplicarTema(tema);
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
