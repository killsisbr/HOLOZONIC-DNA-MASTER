# AUDITORIA DE PERSISTÊNCIA & FRONTEND (DNA JARVIS 4.1)

## 1. Status Quo: Memória Relacional (Persistente)
A landing page (`index.html`) foi totalmente integrada ao backend Express/Prisma.

| Recurso | Estado Atual | Garantia |
| :--- | :--- | :--- |
| **Fluxo Inêz** | Sincronizado com `/api/patients` e `/api/agenda`. | Conflitos evitados via server-lock. |
| **Chat Cecília** | Conectado a `/api/ai/ask`. | Respostas inteligentes (Ollama/Gemini). |
| **Teste do Sono** | Capturado via ClinicalRecord. | Dados vinculados ao CPF do paciente. |
| **Hospedagem** | Integrado ao fluxo de lead. | Registro automático no banco de dados. |

## 2. Gaps de Implementação (O que falta)

### 2.1. Persistência de Sessão (Offline-first)
- **Ação**: Implementar `saveToStorage()` e `loadFromStorage()` para os 4 fluxos principais.
- **Motivo**: Garantir que um "Lead" não seja perdido por instabilidade de rede ou fechamento acidental da aba.

### 2.2. Integração Backend Real-Time
- **Ação**: O `syncInezToBackend()` deve ser disparado em cada passo concluído, não apenas no final.
- **Ação**: Implementar `syncCeciliaToBackend()` para logar intenções de dúvida.

### 2.3. Inteligência Artificial Real
- **Ação**: Substituir as respostas de "Cecília" (hardcoded em `index.html:3927`) por chamadas ao endpoint `/api/ai/ask`.

### 2.4. Ativos Locais
- **Ação**: O site depende de 4 CDNs (Tailwind, FontAwesome, Google Fonts, Imgur). Isso quebra o requisito **Offline-first**.
- **Solução**: Baixar assets para `/public/assets/`.

## 3. Roadmap de Evolução (JARVIS Next)

1. [x] **Fase 1**: Adicionar lógica de persistência para todos os fluxos.
2. [x] **Fase 2**: Implementar Auto-Save para o servidor em cada mudança de passo.
3. [x] **Fase 3**: Integrar Ollama (Backend) no chat da Cecília.
4. [ ] **Fase 4**: Migração total para `dashboard_v2.html` com WebSockets.

---
*Relatório revisado por JARVIS-001 em 29/03/2026*
