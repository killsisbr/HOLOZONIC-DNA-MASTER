const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const path = require('path');
const keyFile = path.resolve(__dirname, 'google-key.json');

async function getGoogleAuthClient() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFile,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    return await auth.getClient();
  } catch (error) {
    console.error('JARVIS: Google Auth Client Error:', error.message);
    return null;
  }
}

async function syncAppointmentToGoogle(appointmentId) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true }
    });

    const auth = await getGoogleAuthClient();
    if (!auth) return;

    const calendar = google.calendar({ version: 'v3', auth });

    // Handle multiple dateTime formats
    let startDateTimeStr = appointment.dateTime;
    
    // Format "YYYY-MM-DD HH:MM"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(appointment.dateTime)) {
      const [datePart, timePart] = appointment.dateTime.split(' ');
      startDateTimeStr = `${datePart}T${timePart}:00`;
    }
    // Format "HH:MM" only (checkin appointments) — skip Google sync
    else if (/^\d{2}:\d{2}$/.test(appointment.dateTime)) {
      console.log(`JARVIS: Skipping Google sync for checkin appointment (no date): ${appointment.dateTime}`);
      return;
    }
    // Format "DD/MM/YYYY HH:MM"
    else if (/^\d{2}\/\d{2}\/\d{4}/.test(appointment.dateTime)) {
      const [datePart, timePart] = appointment.dateTime.split(' ');
      const [day, month, year] = datePart.split('/');
      startDateTimeStr = `${year}-${month}-${day}T${timePart || '00:00'}:00`;
    }
    
    const startDate = new Date(startDateTimeStr);
    if (isNaN(startDate.getTime())) {
      throw new Error(`Invalid time value: ${appointment.dateTime}`);
    }

    const event = {
      summary: `HOLOZONIC [${appointment.type}]: ${appointment.patient.name}`,
      description: `Procedimento: ${appointment.type}\nStatus: ${appointment.status}\nAgendado via Jarvis 4.1 Sync.`,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: new Date(startDate.getTime() + 60 * 60000).toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      conferenceData: {
        createRequest: {
          requestId: `jarvis_tele_${appointment.id}_${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    if (appointment.googleEventId) {
      const res = await calendar.events.update({
        calendarId: calendarId,
        eventId: appointment.googleEventId,
        resource: event,
        conferenceDataVersion: 1
      });
      const meetLink = res.data.hangoutLink || appointment.meetLink;
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { meetLink }
      });
      console.log(`JARVIS: Google Event/Meet updated for ${appointment.patient.name}`);
    } else {
      const res = await calendar.events.insert({
        calendarId: calendarId,
        resource: event,
        conferenceDataVersion: 1
      });
      const meetLink = res.data.hangoutLink;
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { 
            googleEventId: res.data.id,
            meetLink: meetLink 
        }
      });
      console.log(`JARVIS: Google Event & Meet Link created for ${appointment.patient.name}`);
    }
  } catch (error) {
    console.error('JARVIS: Google Sync Error:', error.message);
  }
}

module.exports = { syncAppointmentToGoogle };
