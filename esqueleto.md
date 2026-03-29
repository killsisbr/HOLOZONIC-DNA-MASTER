# ESQUELETO DO PROJETO: HOLOZONIC CARE (AUDITORIA JARVIS 4.1)

## 1. Auditoria Técnica (Relational Singularity)

### 1.1. Interface (Frontend)
- **index.html**: Website institucional premium com widget Inês/Cecília.
    - *Tech Stack*: Tailwind CSS, Font Awesome, Custom JS.
    - *Status*: **100% Integrado**. Lógica de agendamento e chat conectada ao servidor local.
- **painel.html / dashboard_v2.html**: Sistema de Gestão e Prontuário (PEP).
    - *Tech Stack*: Vanilla CSS/JS (Painel) | Tailwind/Glassmorphism (V2).
    - *Status*: **Produção**. Persistência real em SQLite via Prisma. Fila de atendimento síncrona.

### 1.2. Estratégia de Dados (Relational Memory)
- **Implementado**: SQLite + Prisma configurado para o requisito **Offline-first**.
- **Status**: Estável. Todas as tabelas (Patient, Appointment, ClinicalRecord) operando em tempo real com o servidor.

### 1.3. Inteligência Artificial (Swarm Learning)
- **Implementado**: Integração com **Ollama** (Local) e fallback para **Gemini API**.
- **Status**: Cecília operacional para suporte clínico e Inês para agendamento inteligente.

---

## 2. Esqueleto da Estrutura Atual (Raiz Flat)

```text
HOLOZONIC/
├── .env                 # Credenciais, TEAM_CODE e AI Keys
├── package.json         # Dependências do Sistema
├── backup/              # Originais e versões estáveis
├── prisma/              # Schema SQLite e prod.db
│   └── schema.prisma    # DNA do Banco de Dados
├── server.js            # Express Server Core (Orquestrador)
├── google_calendar.js   # Microserviço de sincronismo Google
├── assets/              # Assets locais (Offline-first) [EM PROGRESSO]
├── index.html           # Landing Page (Inês AI)
├── painel.html          # Dashboard Operacional
└── dashboard_v2.html    # Futuro Dashboard Premium
```

---

## 3. Próximos Passos (DNA Roadmap)

1. [x] **Core Backend**: Node.js e Prisma ativos para persistência real.
2. [x] **Smart Scheduling**: Inês com bloqueio de horários ocupados.
3. [x] **Telemedicina**: Geração automática de links Google Meet.
4. [/] **Polimento UX/UI**: Transição total para Dashboard V2.
5. [ ] **Self-Evolve Engine**: Automatizar aprendizado a partir de logs de erro.

---

## 4. Notas de Auditoria JARVIS
A transição de Memória Volátil para Relacional Singularity foi concluída com sucesso. O sistema agora é resiliente e pronto para escala. O foco atual deve ser o refinamento da IA para suporte clínico avançado.

*Atualizado em 29/03/2026 - Protocolo JARVIS-001*
