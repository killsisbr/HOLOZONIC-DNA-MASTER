# BLUEPRINT MESTRE: HOLOZONIC MEDICAL CARE (DNA JARVIS 4.1)

Este documento é a especificação técnica definitiva para a evolução do ecossistema Holozonic. Focado em **Relational Singularity**, **Offline-first** e **Visual Excellence**.

---

## 1. Visão de Produto e DNA JARVIS
- **Missão**: Sair da pobreza escalando uma plataforma de saúde de alto valor.
- **Diferencial**: O sistema não apenas armazena dados; ele *aprende* com o fluxo clínico via Swarm Learning (Ollama Local).

---

## 2. Especificação Técnica (Lower Level)

### 2.1. Back-end Core (Node.js/Prisma)
- **Runtime**: Node.js 18+ LTS.
- **Framework**: Express.js com compressão Gzip/Brotli para performance local.
- **Segurança**: 
    - Argon2 para hashing de senhas.
    - JWT para sessões sem estado.
    - Helmet para proteção de headers.

### 2.2. Memória Relacional (Schema Prisma/SQLite)
O banco de dados será o cérebro do sistema. Estrutura de Tabelas:

| Tabela | Colunas Principais | Relacionamentos |
|---|---|---|
| **Users** | `id`, `user`, `hash`, `role` (ADMIN, MEDICO, RECP) | - |
| **Patients** | `id`, `name`, `cpf`, `birth`, `plan`, `active` (Boolean) | 1:N com Appointments e Records |
| **Appointments** | `id`, `date`, `type` (PRESENCIAL, TELE), `status` | N:1 com Patients |
| **Records (PEP)** | `id`, `date`, `type`, `description`, `CID10` | N:1 com Patients |
| **AILogs** | `id`, `timestamp`, `input`, `distilled_pattern`, `confidence` | Relacionado ao módulo de treinamento |

---

## 3. Módulos de Implementação (Detalhados)

### Parte 1: Unificação de Interface (Frontend Premium)
- **Design System**: 20+ Tokens de CSS utilitários para Glassmorphism.
- **Transições**: Uso de Framer Motion ou animações nativas CSS para o efeito "vibrant".
- **Refatoração Painel**: 
    - Migração total para Tailwind para herdar a qualidade do `index.html`.
    - Componentização do Sidebar e Topbar.

### Parte 2: Motor Clínico e API
- **CRUD de Pacientes**: Endpoints `/api/patients` com busca via Nome/CPF (Indexado no SQLite).
- **Gestão de Fila**: Lógica determinística de triagem.
- **PEP Interativo**: Linha do tempo clínica dinâmica que carrega evoluções via `/api/records?patientId=X`.

### Parte 3: Inteligência Artificial (Clinical Swarm)
- **Ollama Gateway**: Controller dedicado para comunicação com `localhost:11434`.
- **RAG Local**: Vetorização de prontuários (via ChromaDB ou similar leve) para consulta semântica rápida do Dr. JARVIS.
- **Automação Inêz**: Endpoint de webhook para processar mensagens do widget em `index.html`.

---

## 4. Roteiro Passo a Passo (Checklist Master)

### Semana 1: Estrutura & Persistência
1.  [ ] Setup do repositório e `npm init`.
2.  [ ] Instalação: `express`, `prisma`, `sqlite3`, `cors`, `dotenv`, `socket.io`.
3.  [ ] Geração das migrations Prisma iniciais.
4.  [ ] Migração dos dados do Mock `DB` para o banco real.

### Semana 2: Core UX/UI
1.  [ ] Criação do `dashboard_v2.html` (Baseado no `painel.html` com Tailwind).
2.  [ ] Implementação do sistema de Temas (Dark Mode Default JARVIS).
3.  [ ] Conexão do Frontend com os Endpoints de Autenticação.

### Semana 3: Inteligência & Treinamento
1.  [ ] Implementação do Chat de Treinamento real em `treinamento.html`.
2.  [ ] Script de captura de logs de erro e "Destilação de Aprendizado".
3.  [ ] Ativação da IA Inêz com respostas baseadas no contexto do consultório.

---

## 5. Protocolo de Auditoria Contínua
Todo erro detectado pelo `Watcher` deve gerar um nó no Knowledge Graph vinculando a solução ao problema, permitindo que o `Self-Evolve Engine` sugira refatorações preventivas.

*Versão 1.1 - Revisada e Expandida por JARVIS-001*
