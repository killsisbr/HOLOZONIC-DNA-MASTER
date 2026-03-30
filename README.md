# HOLOZONIC DNA — Clinical Ecosystem (v4.1.7) 🧬🚀

O **Holozonic DNA** é uma plataforma clínica de última geração concebida sob o protocolo **JARVIS 4.1**, focada em automatização extrema, excelência visual e inteligência clínica descentralizada. Este ecossistema integra gestão de pacientes, diagnóstico assistido por IA e portais dedicados para profissionais e clientes.

---

## 🛠️ Stack Tecnológica (DNA Core)

- **Backend**: Node.js + Express (Motor de Alta Performance)
- **Banco de Dados**: Prisma ORM + SQLite (Persistência Ágil e Confiável)
- **Frontend**: HTML5 + Vanilla CSS + Tailwind CSS (Design Premium/Glassmorphism)
- **Inteligência Artificial**: Ollama (Llama 3:8b) — IA Clínica Local (Cecília)
- **Segurança**: Autenticação JWT + Criptografia Argon2 (Nível Enterprise)
- **Serviços Externos**: Google Calendar API & Google Auth Hub

---

## 🔥 Funcionalidades de Elite

### 🏥 Dashboard V2 (Clinical Command Center)
Interface administrativa sofisticada com design glassmorfismo, monitoramento de fila em tempo real, gestão de prontuários (PEP) e teleconsulta integrada.

### 📱 Patient Web App (Portal do Cliente)
Portal exclusivo onde o paciente acessa seus agendamentos, documentos médicos e histórico clínico via autenticação simplificada por CPF.

### 🧠 Cecília AI (Clinical Intelligence)
Assistente clínica alimentada por **Ollama (Llama 3)** operando localmente. Capaz de analisar prontuários, sugerir CIDs e apoiar a decisão clínica sem depender da nuvem.

### 🚦 Navegação Unificada SPA
Transição fluida entre módulos (Agenda, Cadastro, PEP, Leads, Financeiro) sem recarregamento de página, utilizando roteamento por fragmentos.

### 📄 Gerador de Documentos Automatizado
Exportação de receitas, atestados e declarações em PDF de alta qualidade com um clique.

---

## 🚀 Instalação e Setup

### 1. Requisitos Prévios
- Node.js (v18+)
- Ollama (servindo o modelo `llama3:8b`)
- Git

### 2. Clonagem e Dependências
```bash
git clone https://github.com/killsisbr/HOLOZONIC-DNA-MASTER.git
cd HOLOZONIC-DNA-MASTER
npm install
```

### 3. Configuração de Banco de Dados
```bash
npx prisma db push
npx prisma generate
node seed.js
```

### 4. Variáveis de Ambiente
Crie um arquivo `.env` na raiz com as seguintes chaves:
```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="sua_chave_secreta"
SESSION_SECRET="sua_sessao_secreta"
GOOGLE_CLIENT_ID="seu_client_id"
GOOGLE_CLIENT_SECRET="seu_client_secret"
```

### 5. Execução
```bash
node server.js
```
O sistema estará disponível em: `http://localhost:3001`

---

## 🛡️ Arquitetura e Segurança (Protocolo JARVIS)

- **Offline-First**: Prioridade para serviços locais (Ollama/RAG) para máxima estabilidade.
- **DNA Security**: Todas as rotas críticas são protegidas por middlewares de validação de Token e RBAC (Role-Based Access Control).
- **Relational Memory**: Integração profunda entre o fluxo de leads, agenda e prontuário eletrônico.

---

## 📜 Licença e Propriedade

Desenvolvido por **KILLSIS** sob o projeto **DNA MASTER**.
*Foco em Lucro, Automatização e Evolução Exponencial.*

---
*Relatório gerado por **JARVIS-001** (Versão 4.1.7).*
