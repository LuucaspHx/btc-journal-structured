BTC Journal — instruções rápidas

Rodando localmente

1. Abra um terminal e navegue para a pasta do projeto:

```bash
cd /path/to/btc-journal-structured
```

2. Inicie um servidor estático simples (recomendado para evitar problemas com imports e CORS):

```bash
python3 -m http.server 8000
```

Abra http://localhost:8000 no navegador.

Enviar para o GitHub (passo a passo)

1. Inicialize um repositório Git (se ainda não existir):

```bash
git init
git add .
git commit -m "Init btc-journal-structured"
```

2. Crie um repositório vazio no GitHub (pela web). Copie a URL do repositório (ex.: git@github.com:seu-usuario/seu-repo.git ou https://github.com/seu-usuario/seu-repo.git).

3. Configure o remoto e envie:

```bash
git remote add origin <URL-DO-REPO>
git branch -M main
git push -u origin main
```

Se preferir HTTPS, use a URL HTTPS e autentique quando solicitado (ou configure um token).

Executando testes (local)

Se quiser rodar os testes (Jest) localmente:

```bash
# instale dependências
npm install

# rode os testes
npm test
```

Observações
- Recomendo criar um arquivo `.env` (não commitá-lo) se adicionar chaves/segredos no futuro.
- O app é uma SPA estática; hospedar no GitHub Pages é direto (pasta raiz).
