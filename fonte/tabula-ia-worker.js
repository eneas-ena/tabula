/* =====================================================================
   TÁBULA — assistente de IA (Cloudflare Worker "tabula-ia")
   Rotas:
     POST /diagrama  { texto }                 → { mermaid }   (texto vira diagrama)
     POST /codigo    { imagem, textos }        → { html }      (rascunho de tela vira página)
     GET  /saude                               → { ok: true }  (teste do endereço)
   Segurança: só atende quem está logado na Tábula E autorizado (tabula.eh_aprovado).
   Segredo necessário no Worker:  ANTHROPIC_API_KEY
   ===================================================================== */
const SUPA_URL = 'https://ghjbljypxksubmcsvaig.supabase.co';
const SUPA_KEY = 'sb_publishable_qXCYqg1WdmelY9D1mptZXg_U8NdoKby';
const MODELO = 'claude-sonnet-5-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

/* confere no Supabase se o token é de alguém autorizado na Tábula */
async function autorizado(req){
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!tok) return false;
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/eh_aprovado`, {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', 'Content-Profile': 'tabula', 'Accept-Profile': 'tabula' },
    body: '{}',
  });
  if (!r.ok) return false;
  return (await r.json()) === true;
}

async function claude(env, system, content, maxTokens){
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELO, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error((d.error && d.error.message) || ('Erro da IA ' + r.status));
  return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
}
const tirarCercas = t => t.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();

const SISTEMA_DIAGRAMA = `Você transforma pedidos em português em diagramas no formato Mermaid, para um quadro branco.
Responda SOMENTE com o código Mermaid, sem explicações e sem cercas de código.
Regras:
- Use "flowchart TD" (de cima para baixo) ou "flowchart LR" (da esquerda para a direita) para quase tudo: fluxogramas, processos, organogramas, esboços de sermão, estruturas de estudo, mapas mentais (nó central ligado aos ramos) e linhas do tempo (nós em sequência, LR).
- Use "sequenceDiagram" só para conversas ou trocas entre participantes ao longo do tempo, e "classDiagram" só para classes de software.
- Não use mindmap, timeline, gantt, pie nem outros tipos (eles não ficam editáveis).
- Todos os textos em português do Brasil, curtos e claros. Coloque SEMPRE o texto dos nós entre aspas: A["Texto do nó"]. Use <br> para quebrar linhas longas.
- Use formas variadas quando ajudar: ["retângulo"], ("arredondado"), {"decisão"}, (("círculo")).
- Rótulos nas setas quando fizer sentido: A -->|"sim"| B.
- No máximo 30 nós. Prefira clareza a quantidade.
- Em temas bíblicos, cite as referências no formato brasileiro (ex.: Rm 8.28).`;

const SISTEMA_CODIGO = `Você recebe a imagem de um rascunho de tela (wireframe) desenhado à mão num quadro branco, e os textos que aparecem nele.
Gere UMA página HTML completa e autocontida que implemente essa tela.
Regras:
- Responda SOMENTE com o HTML (começando em <!DOCTYPE html>), sem explicações e sem cercas de código.
- CSS e JavaScript embutidos no próprio arquivo; nenhum arquivo externo, exceto fontes do Google se fizer sentido.
- Respeite a disposição do rascunho; use os textos escritos nele; complete com conteúdo de exemplo em português do Brasil quando faltar.
- Visual limpo e moderno, responsivo (funciona no iPad e no celular), com interações simples quando o desenho sugerir (abas, botões, menus).`;

export default {
  async fetch(req, env){
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === '/saude') return json({ ok: true, servico: 'tabula-ia', modelo: MODELO, chave: !!env.ANTHROPIC_API_KEY });
    if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
    if (!env.ANTHROPIC_API_KEY) return json({ erro: 'Falta configurar o segredo ANTHROPIC_API_KEY no Worker.' }, 500);
    try {
      if (!(await autorizado(req))) return json({ erro: 'Acesso não autorizado. Entre na Tábula com uma conta autorizada.' }, 401);
      const corpo = await req.json();

      if (url.pathname === '/diagrama'){
        const texto = String(corpo.texto || '').slice(0, 6000);
        if (!texto.trim()) return json({ erro: 'Escreva o que você quer no diagrama.' }, 400);
        const m = tirarCercas(await claude(env, SISTEMA_DIAGRAMA, texto, 2500));
        return json({ mermaid: m });
      }

      if (url.pathname === '/codigo'){
        const img = String(corpo.imagem || '');
        const m = img.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
        if (!m) return json({ erro: 'Imagem inválida.' }, 400);
        const textos = Array.isArray(corpo.textos) ? corpo.textos.slice(0, 200).join('\n') : '';
        const html = tirarCercas(await claude(env, SISTEMA_CODIGO, [
          { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
          { type: 'text', text: 'Textos que aparecem no rascunho:\n' + (textos || '(nenhum)') },
        ], 12000));
        return json({ html });
      }

      return json({ erro: 'Rota desconhecida.' }, 404);
    } catch (e) {
      return json({ erro: String(e && e.message || e) }, 500);
    }
  },
};
