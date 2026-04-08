class NeverRejectEngine {
    constructor() {
        this.config = {
            workHoursStart: 8,
            workHoursEnd: 18,
            workOnSaturday: true,
            saturdayEnd: 13,
            visitDurationMin: 60,
            slotIncrementMin: 30,
            maxAttempts: 50
        };
    }

    async findAvailableSlot(prisma, requestedDateTime, durationMin = 60) {
        let finalStart = new Date(requestedDateTime);
        let attempts = 0;
        let isAdjusted = false;
        const durationMs = durationMin * 60000;

        while (attempts < this.config.maxAttempts) {
            attempts++;
            const h = finalStart.getHours();
            const d = finalStart.getDay();

            if (d === 0) {
                finalStart.setDate(finalStart.getDate() + 1);
                finalStart.setHours(this.config.workHoursStart, 0, 0, 0);
                isAdjusted = true;
                continue;
            }

            if (d === 6) {
                if (!this.config.workOnSaturday || h >= this.config.saturdayEnd) {
                    finalStart.setDate(finalStart.getDate() + 2);
                    finalStart.setHours(this.config.workHoursStart, 0, 0, 0);
                    isAdjusted = true;
                    continue;
                }
            }

            const effectiveEnd = (d === 6) ? this.config.saturdayEnd : this.config.workHoursEnd;
            if (h < this.config.workHoursStart) {
                finalStart.setHours(this.config.workHoursStart, 0, 0, 0);
                isAdjusted = true;
                continue;
            }
            if (h >= effectiveEnd) {
                finalStart.setDate(finalStart.getDate() + 1);
                finalStart.setHours(this.config.workHoursStart, 0, 0, 0);
                isAdjusted = true;
                continue;
            }

            const endTime = new Date(finalStart.getTime() + durationMs);
            
            const conflicts = await prisma.appointment.findFirst({
                where: {
                    status: { not: 'CANCELADO' },
                    dateTime: {
                        gte: finalStart.toISOString(),
                        lt: endTime.toISOString()
                    }
                }
            });

            if (conflicts) {
                finalStart.setTime(finalStart.getTime() + this.config.slotIncrementMin * 60000);
                isAdjusted = true;
                continue;
            }

            break;
        }

        return { finalStart, isAdjusted };
    }

    formatDisplayDateTime(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return { date: `${day}/${month}/${year}`, time: `${hour}:${minute}`, iso: date.toISOString() };
    }
}

module.exports = new NeverRejectEngine();