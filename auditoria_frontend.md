# AUDITORIA DE PERSISTÊNCIA & FRONTEND (DNA JARVIS 4.1)

## 1. Status Quo: Memória Volátil
Atualmente, toda a inteligência e captura de dados da landing page (`index.html`) opera em memória volátil.

| Recurso | Estado Atual | Risco |
| :--- | :--- | :--- |
| **Fluxo Inêz** | Variável `inezData` em JS. | Perda total de dados se o usuário der F5 no meio do agendamento. |
| **Chat Cecília** | DOM dinâmico sem histórico. | Diálogo some ao atualizar. |
| **Teste do Sono** | Variável `sonoData`. | Usuário precisa recomeçar o teste se a página recarregar. |
| **Hospedagem** | Variável `hospedagemData`. | Dados de reserva não persistem. |

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

## 3. Roadmap de Correção (JARVIS Priority)

1. [ ] **Fase 1**: Adicionar lógica de `localStorage` para `inezData`, `sonoData` e `hospedagemData`.
2. [ ] **Fase 2**: Implementar Auto-Save para o servidor em cada mudança de passo (Debounced).
3. [ ] **Fase 3**: Integrar Ollama (Backend) no chat da Cecília para suporte real.
4. [ ] **Fase 4**: Localização de Assets (CSS/JS/Fonts/Images).

---
*Relatório gerado por JARVIS-001 em 28/03/2026*
