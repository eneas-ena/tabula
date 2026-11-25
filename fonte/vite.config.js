import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
const PT = readFileSync(new URL('./traducoes-ptbr.json', import.meta.url), 'utf8');

/* Troca, dentro do editor, o nome "Excalidraw" que aparece na tela e a extensão dos arquivos.
   O conteúdo do arquivo continua no formato aberto (JSON), então .excalidraw antigos também abrem. */
const TROCAS = [
  // salvar / abrir arquivos
  [/extension:"excalidraw",description:"Excalidraw file"/g, 'extension:"tabula",description:"Arquivo da Tábula"'],
  [/e\?\.name\?\.endsWith\("\.excalidrawlib"\)/g, '(e?.name?.endsWith(".excalidrawlib")||e?.name?.endsWith(".tabulalib"))'],
  [/e\?\.name\?\.endsWith\("\.excalidraw"\)/g, '(e?.name?.endsWith(".excalidraw")||e?.name?.endsWith(".tabula"))'],
  [/extension:"excalidrawlib",description:"Excalidraw library file"/g, 'extension:"tabulalib",description:"Biblioteca da Tábula"'],
  [/description:"Excalidraw files"/g, 'description:"Arquivos da Tábula"'],
  [/description:"Excalidraw library files"/g, 'description:"Bibliotecas da Tábula"'],
  [/"excalidraw\.svg":"svg"/g, '"tabula.svg":"svg"'],
  [/"excalidraw\.png":"png"/g, '"tabula.png":"png"'],
  // textos em inglês que não têm tradução no pt-BR
  [/children:"Generate"/g, 'children:"Gerar"'],
  [/label:"Generate"/g, 'label:"Gerar"'],
  [/"Mermaid to Excalidraw"/g, '"Mermaid para diagrama"'],
  [/embeddable:"Web Embed"/g, 'embeddable:"Incorporar site"'],
  [/title:"Find on canvas"/g, 'title:"Buscar na tela"'],
  [/"Excalidraw links"/g, '"Links da Tábula"'],
  [/"Excalidraw Embedded Content"/g, '"Conteúdo incorporado"'],
  [/\?"Frame":"AI Frame"/g, '?"Quadro":"Quadro IA"'],
  // janela de IA (texto para diagrama)
  [/"Currently we use Mermaid as a middle step, so you'll get best results if you describe a diagram, workflow, flow chart, and similar\."/g, '"Descreva o que você quer ver: fluxograma, processo, esboço de sermão, mapa mental, linha do tempo. Ex.: Esboço de Romanos 8 em 4 pontos."'],
  [/"View as Mermaid"/g, '"Ver o código Mermaid"'],
  [/label:"Insert"/g, 'label:"Inserir"'],
  [/children:"AI Beta"/g, 'children:"IA"'],
  [/label:"Preview"/g, 'label:"Prévia"'],
  [/placeholder:"Describe what you want to see\.\.\."/g, 'placeholder:"Descreva o que você quer ver..."'],
  [/placeholder:"Write Mermaid diagram defintion here\.\.\."/g, 'placeholder:"Escreva aqui o código Mermaid..."'],
  [/"Generated an invalid diagram :\(\. You may also try a different prompt\."/g, '"A IA gerou um diagrama inválido. Tente pedir de outro jeito."'],
  [/"Cannot generate from an empty frame"/g, '"O quadro está vazio."'],
  [/"Generation failed"/g, '"Não foi possível gerar."'],
  [/"Generation was interrupted\.\.\."/g, '"A geração foi interrompida..."'],
  [/"Request failed"/g, '"O pedido falhou"'],
  [/"Unknown error during generation"/g, '"Erro desconhecido ao gerar"'],
];
function trocarNome(){
  const usadas = new Set();
  return {
    name: 'tabula-nome', enforce: 'pre',
    transform(code, id){
      if (!id.includes('@excalidraw/excalidraw/dist/prod') || !id.endsWith('.js')) return null;
      let out = code;
      TROCAS.forEach(([re, novo], i) => { if (re.test(out)){ usadas.add(i); out = out.replace(re, novo); } re.lastIndex = 0; });
      // textos das traduções (pt-BR e inglês): Excalidraw → Tábula dentro das frases
      if (/locales\/(pt-BR|en)-|chunk-6U3AYISY/.test(id))
        out = out.replace(/(?<![A-Za-z_$.])Excalidraw\+?(?![A-Za-z_$])/g, 'Tábula');
      // completa no pt-BR as frases que o editor só tem em inglês (traducoes-ptbr.json)
      if (/locales\/pt-BR-/.test(id)){
        const m = out.match(/export\{[^}]*\b(\w+) as default/);
        if (!m) this.error('pt-BR: export default não encontrado');
        const junta = `;(function(o,a){for(const k in a){const p=k.split('.');let t=o;for(let i=0;i<p.length-1;i++){t=t[p[i]]=t[p[i]]||{}}const f=p[p.length-1];if(!t[f])t[f]=a[k]}})(${m[1]},${PT});\n`;
        out = out.replace(/export\{[^}]*\}\s*;?\s*$/, x => junta + x);
        usadas.add('pt');
      }
      return out === code ? null : { code: out, map: null };
    },
    buildEnd(){
      const faltou = TROCAS.map((t, i) => i).filter(i => !usadas.has(i));
      if (!usadas.has('pt')) this.error('Traduções pt-BR não aplicadas');
      if (faltou.length) this.error('Trocas não aplicadas: ' + faltou.map(i => TROCAS[i][0]).join(' | '));
    },
  };
}
export default defineConfig({
  plugins: [trocarNome(), react(), viteSingleFile({ removeViteModuleLoader: true })],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.IS_PREACT': '"false"' },
  build: { target: 'es2020', chunkSizeWarningLimit: 20000, assetsInlineLimit: 100000000 },
});
