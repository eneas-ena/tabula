import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

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
      return out === code ? null : { code: out, map: null };
    },
    buildEnd(){
      const faltou = TROCAS.map((t, i) => i).filter(i => !usadas.has(i));
      if (faltou.length) this.error('Trocas não aplicadas: ' + faltou.map(i => TROCAS[i][0]).join(' | '));
    },
  };
}
export default defineConfig({
  plugins: [trocarNome(), react(), viteSingleFile({ removeViteModuleLoader: true })],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.IS_PREACT': '"false"' },
  build: { target: 'es2020', chunkSizeWarningLimit: 20000, assetsInlineLimit: 100000000 },
});
