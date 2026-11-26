# Torre Indicadores

O menu Postos de combustível e o menu Ciclo florestal têm uma aba Importação cada. Nessas abas é possível importar planilhas Excel, consultar o período por arquivo e excluir bases. O painel recalcula os indicadores com o catálogo ativo. Arquivos repetidos são identificados pelo conteúdo normalizado.

## Uso local

Abra `Torre_Indicadores.html` no navegador. Ele contém as três bases iniciais, e alterações locais ficam no armazenamento daquele navegador. Importar também é possível em uma instalação Web, onde o catálogo é compartilhado entre aparelhos.

## Publicação em um projeto separado

Confirme primeiro o repositório GitHub, a branch de produção, a conta Cloudflare e o nome do Worker de destino. Use `npx wrangler whoami` na sessão Cloudflare autorizada para conferir a conta. Crie um D1 exclusivo do Torre Indicadores e informe o ID real em `wrangler.jsonc`. O binding do Worker é `DB`. O endpoint é `/api/data`, com controle de revisão no catálogo. Preserve os controles de acesso do destino e aplique-os ao site e ao endpoint.

Para preparar o banco remoto novo, execute na raiz do projeto:

```sh
npx wrangler d1 migrations apply DB --remote
npm run seed:sql
npx wrangler d1 execute DB --remote --file ./seed/catalogo.sql
```

A carga inicial roda apenas quando a revisão do catálogo é zero. O arquivo `seed/bases.json` acompanha o pacote para essa carga e fica fora do diretório publicado e do controle de versão.

Para validar e publicar no Worker de destino configurado:

```sh
npm ci
npm run build
npm test
npx wrangler deploy
```

Na integração GitHub da Cloudflare, use `npm run build` como comando de build e `npx wrangler deploy` como comando de deploy, apontando para a branch de produção do repositório de destino. Após a publicação, confira a URL real retornada, os dois menus e uma chamada autenticada a `/api/data`.

## Arquivos

`worker.mjs` contém a API. `migrations/` contém o esquema D1. `importacao.js` converte as planilhas e consolida as bases ativas. `bases.js` integra o catálogo à API ou ao armazenamento local. `painel.js` contém os indicadores, filtros e gráficos.
