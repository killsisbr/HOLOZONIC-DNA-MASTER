# Relatório Comparativo: Agenda CRM-VENDA vs HOLOZONIC

## Visão Geral

| Aspecto | CRM-VENDA | HOLOZONIC |
|---------|-----------|-----------|
| **Motor de Agendamento** | IA (Never-Reject) | Manual com Mutex |
| **Database** | SQLite (por tenant) | PostgreSQL (Prisma) |
| **Lógica de Conflito** | Auto-ajuste de horário | Bloqueio explícito |
| **UX Agendamento** | O usuário escolhe data/hora → IA ajusta | Usuário seleciona slot → sistema verifica |

---

## 1. Motor de Agendamento (Core Engine)

### CRM-VENDA: AppointmentEngine (appointment_engine.js)

```javascript
// Lógica Never-Reject
findAvailableSlot(db, startDate, durationMin = 60)
```

**Características:**
- Analisa o horário solicitado
- Se ocupado → Automatically finds next available slot (30-min increments)
- Skip Sundays → move to Monday 8h
- Skip Saturday afternoon → move to Monday
- Valida overlap (start < end && end > start)
- Retorna `isAdjusted: true/false` para feedback ao usuário

**Fluxo:**
1. Usuário pede agendamento
2. IA extrai data/hora do texto
3. `findAvailableSlot()` tenta o horário pedido
4. Se conflita → pula 30 min e tenta novamente (até 50 tentativas)
5. Se disponível → confirma; se ocupado → sugere próximo horário
6. Persiste no SQLite

### HOLOZONIC: routes/agenda.js

**Características:**
- Mutex para bloquear slots durante criação
- Verificação explícita: `SELECT * FROM appointments WHERE dateTime = ?`
- Se ocupado → retorna erro 409 "Slot ocupado"
- Sem auto-ajuste, sem sugestão de alternativos

**Fluxo:**
1. Usuário escolhe horário no frontend
2. Backend verifica se slot está livre
3. Se livre → cria agendamento
4. Se ocupado → retorna erro (usuário deve escolher outro)

---

## 2. Tratamento de Conflitos

| Cenário | CRM-VENDA | HOLOZONIC |
|---------|-----------|-----------|
| Horário ocupado | Sugere próximo disponível automaticamente | Retorna erro 409 |
| Domingo | Pula para segunda 8h | Sem validação (depende do frontend) |
| Sábado à tarde | Pula para segunda | Sem validação |
| Múltiplos agendamentos | Overlap check (strict) | Não há verificação de overlap |

---

## 3. Reschedule (Reagendamento)

### CRM-VENDA
- Não encontrado código de reschedule explícito
-假定: Novo agendamento = mesma lógica never-reject

### HOLOZONIC (agenda.js:59-122)
```javascript
router.post('/reschedule', authenticateToken, async (req, res) => {
  // 1. Adquire lock no novo slot
  // 2. Verifica se está livre
  // 3. Atualiza appointment com novo dateTime
  // 4. Envia notificação WhatsApp
  // 5. Sincroniza Google Calendar
  // 6. Libera lock
})
```

**Diferencial HOLOZONIC:**
- Tracking de `rescheduleCount`
- Preserva `originalDateTime` para histórico
- Motivo do reagendamento
- Integração WhatsApp + Google Calendar

---

## 4. Cancelamento

### CRM-VENDA
- Não encontrado código específico

### HOLOZONIC (agenda.js:21-56)
```javascript
router.post('/cancel', authenticateToken, async (req, res) => {
  // 1. Atualiza status para 'CANCELADO'
  // 2. Salva cancelReason
  // 3. Envia notificação WhatsApp
  // 4. Broadcast via Socket.io
})
```

---

## 5. Integrações

| Integração | CRM-VENDA | HOLOZONIC |
|-----------|-----------|-----------|
| WhatsApp | Não encontrado | ✅ Envio de msgs |
| Google Calendar | Não encontrado | ✅ Sync bidirecional |
| Socket.io | Não encontrado | ✅ Broadcast updates |
| SMS/Email | Não implementado | Parcial (via WhatsApp) |

---

## 6. No-Show

### CRM-VENDA
- Não encontrado

### HOLOZONIC (agenda.js:125-145)
- Flag `noShow: true`
- Status `NO_SHOW`
- Útil para relatórios de produtividade

---

## 7. Configuração

### CRM-VENDA (appointment_engine.js:7-14)
```javascript
config = {
  workHoursStart: 8,
  workHoursEnd: 18,
  workOnSaturday: true,
  saturdayEnd: 13,
  visitDurationMin: 60
}
```

### HOLOZONIC
- Não há config centralizada (hardcoded no frontend?)
- Depende do frontend para validar horário comercial

---

## 8. Sugestões de Melhoria para HOLOZONIC

### 🔴 Prioridade Alta

1. **Implementar Never-Reject Engine**
   - Adapter pattern: criar `AppointmentEngine` similar ao CRM-VENDA
   - Receber horário desejado → retornar próximo disponível
   - Feedback contextual: "Horário ocupado. Posso agendar para [DATA/HORA]?"

2. **Centralizar Config**
   - Criar tabela `settings` ou arquivo config
   - workHoursStart, workHoursEnd, saturdayEnd, visitDuration

3. **Validação de Overlap**
   - Verificar não apenas slot exato, mas intervalos que se sobrepõem

### 🟡 Prioridade Média

4. **Extração de Data/IA**
   - Similar ao CRM-VENDA: parse de "hoje", "amanhã", "15/03 às 14h"
   - Integrar com WhatsApp AI para NLP

5. **Dashboard de Produtividade**
   - Taxa de no-show
   - Taxa de cancelamento
   - Occupancy rate por dia/hora

### 🟢 Prioridade Baixa

6. **Slots Recorrentes**
   - Paciente weekly/monthly appointments

7. **Lista de Espera**
   - Auto-notify quando slot abrir

---

## 9. Conclusão

| Avaliação | CRM-VENDA | HOLOZONIC |
|-----------|-----------|-----------|
| **UX Agendamento** | ⭐⭐⭐⭐⭐ (Never-reject) | ⭐⭐⭐ (Manual) |
| **Robustez** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Integrações** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Manutenibilidade** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Recomendação:** Adotar lógica Never-Reject do CRM-VENDA em HOLOZONIC, mantendo integrações WhatsApp + Google Calendar existentes.

---

*Gerado em: 2026-04-08*
*JARVIS v4.5 - Swarm Learning*