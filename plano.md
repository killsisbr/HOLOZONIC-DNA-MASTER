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
O banco de dados é o centro do sistema. Estrutura de Tabelas Real:

| Tabela | Colunas Principais | Relacionamentos |
|---|---|---|
| **User** | `id`, `user`, `hash`, `role`, `googleId` | - |
| **Patient** | `id`, `name`, `cpf`, `birthDate`, `plan`, `active` | 1:N com Appointment e ClinicalRecord |
| **Appointment** | `id`, `dateTime`, `type`, `status`, `googleEventId`, `meetLink` | N:1 com Patient |
| **ClinicalRecord** | `id`, `date`, `type`, `description`, `cid10` | N:1 com Patient |
| **AILog** | `id`, `timestamp`, `input`, `distilledPattern`, `confidence` | Logs de evolução IA |
| **PotentialLead** | `id`, `name`, `phone`, `email`, `source`, `step`, `data` | Funil de Vendas/Inês |

---

## 3. Módulos de Implementação (Detalhados)

### Parte 1: Unificação de Interface (Frontend Premium) [CONCLUÍDO]
- **Design System**: Tailwind CSS integrado na Landing Page e Dashboard.
- **Transições**: Animações suaves de loading e feedback de agendamento.
- **Refatoração Painel**: Dashboards conectados à API `/api/agenda`.

### Parte 2: Motor Clínico e API [CONCLUÍDO]
- **CRUD de Pacientes**: Busca e criação inteligente sincronizada com o CPF.
- **Gestão de Fila**: Fila operacional em tempo real via `/api/agenda/checkin`.
- **Telemedicina**: Geração automática de links Meet via Google Calendar API.

### Parte 3: Inteligência Artificial (Clinical Swarm) [CONCLUÍDO]
- **Dual-Brain Strategy**: Ollama (Local) + Gemini (Fallback API).
- **RAG Contextual**: Cecília ciente do contexto clínico via `/api/ai/ask`.
- **Automação Inêz**: Agendamento consciente de disponibilidade (Conflict-free).

---

## 4. Roteiro Passo a Passo (Checklist Master)

### Semana 1: Estrutura & Persistência [CONCLUÍDO]
1.  [x] Setup do repositório e `npm init`.
2.  [x] Instalação: `express`, `prisma`, `sqlite3`, `cors`, `dotenv`.
3.  [x] Geração das migrations Prisma e estabilização de schema.

### Semana 2: Core UX/UI [CONCLUÍDO]
1.  [x] Integração total da Landing Page com o Backend.
2.  [x] Conexão do Dashboard V2 com dados reais do SQLite.

### Semana 3: Inteligência & Publicação [CONCLUÍDO]
1.  [x] Ativação da IA Inêz com verificação de agenda real.
2.  [x] Implementação de redundância Gemini para Offline-first resiliente.
3.  [x] Publicação em repositório público (HOLOZONIC-DNA-MASTER).

---

## 5. Protocolo de Auditoria Contínua
Todo erro detectado (ex: Error 500 no Prisma) gera um aprendizado que refina a estabilidade do nó central.

*Versão 1.2 - Revisada por JARVIS-001 em 29/03/2026*
