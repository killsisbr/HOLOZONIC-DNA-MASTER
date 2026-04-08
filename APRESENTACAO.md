# HOLOZONIC - Apresentação do Projeto

## Visão Geral

**HOLOZONIC** é uma plataforma completa de gestão para clínicas de medicina integrativa e longevidade. Desenvolvida com tecnologia de ponta, oferece desde agendamento inteligente até videochamadas P2P e monitoramento de pacientes.

---

## Tecnologias

| Categoria | Tecnologia |
|-----------|------------|
| **Backend** | Node.js + Express |
| **Database** | PostgreSQL (Prisma) |
| **Realtime** | Socket.IO |
| **Auth** | JWT + Argon2 |
| **Frontend** | HTML + TailwindCSS |
| **PWA** | Service Worker |
| **Push** | Web Push API |
| **Video** | WebRTC P2P |
| **WhatsApp** | whatsapp-web.js |

---

## Funcionalidades Principais

### 1. Agenda Inteligente (Never-Reject Engine)
- Agendamento automático com ajuste inteligente
- Pula domingos e sábados à tarde
- Busca próximo slot disponível (30-min increments)
- Retorna horário ajustado no response

### 2. PWA Completo
- Service Worker com cache strategies
- Funciona offline
- Install prompt nativo
- Ícones SVG para todas as resoluções

### 3. Push Notifications
- Notificações em tempo real
- VAPID keys configuradas
- Integração automática com agendamento
- Frontend e backend ready

### 4. Videochamada P2P
- WebRTC sem第三方 (Google Meet)
- Transcrição em tempo real
- Resumo via IA (Gemini/Ollama)
- Prontuário automático

### 5. Módulos do Painel Admin
- **Cadastro Pacientes** - API completa
- **Agenda Operacional** - Lista, cria, cancela, reagenda
- **Gestão Financeira** - Dashboard, transações
- **Leads** - Sync, conversão, tracking
- **Telemedicina** - Iniciar/finalizar consultas
- **Prontuário** - Records e anexos
- **Monitoramento** - Dados de wearables

### 6. App Mobile (index-mobile.html)
- Bottom navigation
- Agendamento 3 steps
- Quick actions grid
- Popup de procedimentos
- Integração API leads

---

## Estrutura de Arquivos

```
HOLOZONIC/
├── server.js              # Main server
├── auth.js                # Auth module (JWT)
├── pwa-init.js            # PWA registration
├── sw.js                  # Service Worker
├── manifest.json          # Web App Manifest
├── icons/                 # PWA icons (SVG)
├── lib/
│   ├── prisma.js          # DB client
│   ├── socket.js          # Socket.IO
│   ├── push.js            # Push notifications
│   └── whatsapp.js        # WhatsApp integration
├── routes/
│   ├── agenda.js          # Appointments (Never-Reject)
│   ├── patients.js        # Patients CRUD
│   ├── leads.js           # Leads management
│   ├── finance.js        # Financial dashboard
│   ├── teleconsulta.js   # Video calls
│   ├── monitoring.js     # Wearables data
│   └── ...
├── system/
│   └── never-reject-engine.js
└── *.html                 # Frontend pages
```

---

## APIs Disponíveis

| Endpoint | Descrição |
|----------|-----------|
| `POST /api/auth/login` | Autenticação JWT |
| `GET/POST /api/patients` | Pacientes CRUD |
| `GET/POST /api/agenda` | Agenda (Never-Reject) |
| `POST /api/agenda/cancel` | Cancelar agendamento |
| `POST /api/agenda/reschedule` | Reagendar |
| `GET /api/finance/dashboard` | Financeiro |
| `GET/POST /api/leads` | Leads |
| `POST /api/leads/convert` | Converter lead → paciente |
| `POST /api/teleconsulta/:id/start` | Iniciar videochamada |
| `POST /api/push/subscribe` | Registrar push |
| `POST /api/push/send` | Enviar notificação |
| `POST /api/monitoring/push` | Receber dados wearable |

---

## Credenciais

```
Usuário: admin
Senha: 1234
```

---

## Status Atual

| Módulo | Status |
|--------|--------|
| Backend API | ✅ 100% |
| Never-Reject Engine | ✅ Funcionando |
| PWA/Service Worker | ✅ Implementado |
| Push Notifications | ✅ Configurado |
| Autenticação JWT | ✅ Implementado |
| Painel Admin | ✅ Com login |
| App Mobile | ✅ Ready |

---

## Como Executar

```bash
cd D:/VENDA/HOLOZONIC
node server.js
# Acesse: http://localhost:3001
```

---

## Diferenciais

1. **Never-Reject** - O sistema nunca diz "não", sempre sugere alternativa
2. **Offline-First** - PWA funciona sem internet
3. **Video P2P** - Sem mensalidade de Meet/Zoom
4. **Local-First** - Dados ficam na clínica (não depends de cloud)
5. **Multi-canal** - WhatsApp, Push, Email

---

**HOLOZONIC v4.5** - *Build Mode*
*Desenvolvido por JARVIS DNA*