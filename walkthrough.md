# Walkthrough: HOLOZONIC VPS Deployment

Deployment do ecossistema HOLOZONIC concluído com sucesso. O sistema está operacional e isolado.

## Resumo das Ações
- **Correção de Paths**: Alterado `schema.prisma` e `.env` para usar paths relativos, garantindo compatibilidade entre Windows (Local) e Linux (VPS).
- **Packaging**: Projeto empacotado (`tar.gz`) excluindo arquivos de persistência e dependências locais.
- **Transporte**: Upload via SCP para o servidor `82.29.58.126`.
- **Configuração Remota**:
  - Extração em `/var/www/holozonic-41000`.
  - Instalação de dependências de produção.
  - Configuração do PM2 (`holozonic-v4`) na porta 41000.
  - Setup do Nginx com Proxy Reverso para `holozonic.com.br`.

## Verificação de Sucesso
- **Processo**: `holozonic-v4` está ONLINE.
- **Acessibilidade**: `http://holozonic.com.br` respondendo (HTTP 200).
- **Banco de Dados**: Prisma client regenerado e conectado via `DATABASE_URL` relativa.

## Comandos Úteis (VPS)
```bash
# Ver logs
pm2 logs holozonic-v4

# Reiniciar
pm2 restart holozonic-v4

# Status Nginx
nginx -t
systemctl reload nginx
```
