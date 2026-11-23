# Comprô

Loja de compras simuladas: a pessoa navega, enche o carrinho e conclui a compra, mas nada é cobrado e nada é entregue.

- `index.html`: o app (abre na raiz do site).
- `painel/`: painel de acessos, protegido por senha.
- `privacidade.html`: aviso de privacidade (LGPD).
- `api/`: funções da Vercel que recebem dados anônimos de uso e alimentam o painel.
- `img/`: fotos dos produtos (Unsplash, licença livre).

## O que o painel mostra

Acessos, visitantes únicos, compras simuladas, buscas, produtos mais comprados, cidade aproximada e indicações. Só conta quem aceitou o aviso de privacidade. Não coleta nome, endereço, e-mail, IP nem dados de cadastro.

## Como publicar na Vercel

1. Em vercel.com, clique em **Add New › Project**, importe o repositório `Compro` e clique em **Deploy** (não precisa mudar nada nas configurações).
2. No projeto, abra **Storage › Create Database**, escolha **Upstash for Redis** (plano grátis), região São Paulo se houver, e conecte ao projeto `compro`. Isso cria as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` sozinho.
3. Em **Settings › Environment Variables**, crie `ADMIN_PASSWORD` com a senha do painel.
4. Em **Deployments**, abra o último deploy e clique em **Redeploy** para as variáveis valerem.

Depois disso: o app fica em `https://<seu-projeto>.vercel.app/` e o painel em `https://<seu-projeto>.vercel.app/painel/`.

## Regras de cupom no servidor

- Cada 100º visitante único ganha um cupom de 30% (`api/t.js`, `EVERY_N_USERS`).
- Quem indica ganha um cupom de 20% para cada amigo novo que chega pelo seu link (`api/ref.js`).
