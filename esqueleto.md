# ESQUELETO DO PROJETO: HOLOZONIC CARE (AUDITORIA JARVIS 4.1)

## 1. Auditoria Técnica (Relational Singularity)

### 1.1. Interface (Frontend)
- **index.html**: Website institucional premium.
    - *Tech Stack*: Tailwind CSS, Font Awesome, Custom JS.
    - *Status*: Visualmente pronto para produção.
    - *Observação*: A lógica de simulação IA precisa ser vinculada a um back-end real.
- **painel.html**: Sistema de Gestão e Prontuário (PEP).
    - *Tech Stack*: Vanilla CSS/JS.
    - *Status*: Protótipo funcional com mock data.
    - *Oportunidade*: Padronizar o estilo com o `index.html` (Tailwind) para uma experiência coesa. Proposta de design "Glassmorphism" no Dashboard.

### 1.2. Estratégia de Dados (Relational Memory)
- O projeto atual não persiste dados (volátil).
- Proposta: Implementar **SQLite + Prisma** para o requisito **Offline-first**. Toda a Fila de Atendimento e PEP deve ser salva de forma relacional.

### 1.3. Inteligência Artificial (Swarm Learning)
- O `painel.html` possui uma aba de teleconsulta que gera evoluções clínicas.
- Proposta: Integrar **Ollama** para sumarização automática destas evoluções e suporte ao diagnóstico baseado em histórico.

---

## 2. Esqueleto da Estrutura Proposta

```text
HOLOZONIC/
├── .env                # Credenciais e TEAM_CODE (DNA JARVIS)
├── package.json        # Dependências do Sistema
├── backup/             # Backup dos originais (index.bak, painel.bak) [CONCLUÍDO]
├── backend/            # Lógica de Servidor (Offline-first)
│   ├── server.js       # Express Server
│   ├── prisma/         # Schema SQLite (Relational Memory)
│   │   └── schema.prisma
│   └── routes/         # Endpoints: /api/pacientes, /api/agenda
├── public/             # Interface Unificada (Frontend)
│   ├── css/            # Estilos Glassmorphism
│   ├── js/             # Lógica modularizada
│   ├── index.html      # Landing Page refatorada
│   ├── painel.html     # Dashboard integrado
│   └── treinamento.html # Central de Treinamento IA [NEW]
└── esqueleto.md        # Este documento de auditoria e roadmap
```

---

## 3. Próximos Passos (DNA Roadmap)

1.  **Backup Integral**: Realizado em `d:\VENDA\HOLOZONIC\backup\`.
2.  **Unificação Visual**: Migrar `painel.html` para um layout premium integrado (Tailwind + Custom Glass CSS).
3.  **Core Backend**: Inicializar Node.js e Prisma para persistência real de pacientes e consultas.
4.  **Clinical AI**: Desenvolver o nódulo de integração Ollama para suporte no PEP.

---

## 4. Notas de Auditoria JARVIS
A arquitetura monolítica atual (`painel.html`) é excelente para prototipagem rápida, mas o risco de "Single Point of Failure" é alto sem persistência. O foco agora deve ser a **estabilidade** e a **automação**.
