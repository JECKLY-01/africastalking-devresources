const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const AfricasTalking = require("africastalking");
const cron = require("node-cron");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// === Initialize Africa's Talking ===
const africastalking = AfricasTalking({
  apiKey: 'atsk_c165305e8a6f3ce6b07a588885c7d06cd72b5e97b4badf93e515f7d4fc053e160df50346',
  username: 'jeckly'
});
const sms = africastalking.SMS;

// === Patients Data (Shared) ===
const patients = [
  { name: "Lynnet Sithole", county: "Chimoio", phone: "+254714938333", appointment: "2025-07-03T17:43", language: "en" },
  { name: "Jone Mucua", county: "Manica", phone: "+254714938333", appointment: "2025-07-03T17:45", language: "en" },
  { name: "John Mwangi", county: "Nyeri", phone: "+254714938333", appointment: "2025-07-03T17:40", language: "en" },
  { name: "Jospat", county: "Garissa", phone: "+254790175477", appointment: "2025-07-03T20:09", language: "sw" },
  { name: "Peter Odhiambo", county: "Kisumu", phone: "+254733000003", appointment: "2025-07-06T14:00", language: "en" }
];

// === Helper: Load Sent Reminders ===
const sentPath = path.join(__dirname, "sent_reminders.json");
function loadSentReminders() {
  if (!fs.existsSync(sentPath)) {
    fs.writeFileSync(sentPath, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(sentPath));
}

function saveSentReminders(sentList) {
  fs.writeFileSync(sentPath, JSON.stringify(sentList, null, 2));
}

// === Reminder Logic ===
function isWithin10Minutes(appointmentTime) {
  const now = new Date();
  const appt = new Date(appointmentTime);
  const diff = appt - now;
  return diff > 0 && diff <= 10 * 60 * 1000;
}

async function sendReminders() {
  const sentReminders = loadSentReminders();
  const reminders = patients.filter(p => {
    const key = `${p.phone}-${p.appointment}`;
    return isWithin10Minutes(p.appointment) && !sentReminders.includes(key);
  });

  const results = [];

  for (const patient of reminders) {
    const key = `${patient.phone}-${patient.appointment}`;
    const message = `Hello ${patient.name}, reminder: Your clinic appointment is on ${patient.appointment} in ${patient.county}. Dial *384*123# to confirm.`;

    try {
      const result = await sms.send({
        to: [patient.phone],
        message,
        from: 'AFTKNG',
        enqueue: true
      });

      sentReminders.push(key);
      saveSentReminders(sentReminders);

      results.push({ phone: patient.phone, status: "sent", result });
      console.log(`✅ Sent to ${patient.phone}`);
    } catch (err) {
      results.push({ phone: patient.phone, status: "error", error: err.toString() });
      console.error(`❌ Error sending to ${patient.phone}:`, err.toString());
    }
  }

  return results;
}

// === Cron Job: Every Minute ===
cron.schedule("* * * * *", async () => {
  console.log("⏰ Running reminder job...");
  await sendReminders();
});

// === Manual SMS Trigger Route ===
app.post("/send-reminders", async (req, res) => {
  const results = await sendReminders();
  res.status(200).json({ status: "completed", results });
});

// === USSD Logic ===
app.post("/ussd", (req, res) => {
  const { phoneNumber, text } = req.body;
  const inputs = text.split("*");
  let response = "";

  const patient = patients.find(p => p.phone === phoneNumber);
  if (!patient) {
    response = `END Sorry, you're not registered.`;
  } else if (text === "") {
    response = `CON Hello ${patient.name},\n1. View Appointment\n2. Confirm Attendance\n3. Reschedule\n4. Request Transport`;
  } else if (inputs[0] === "1") {
    response = `END Your appointment is on ${patient.appointment}`;
  } else if (inputs[0] === "2") {
    logAction(phoneNumber, "Confirmed Appointment");
    response = `END Thank you. You've confirmed your appointment.`;
  } else if (inputs[0] === "3") {
    logAction(phoneNumber, "Requested Reschedule");
    response = `END A health worker will contact you to reschedule.`;
  } else if (inputs[0] === "4") {
    logAction(phoneNumber, "Requested Transport");
    response = `END Transport request received. We will reach out shortly.`;
  } else {
    response = `END Invalid option.`;
  }

  res.set("Content-Type", "text/plain");
  res.send(response);
});

// === Logger for USSD Actions ===
function logAction(phone, action) {
  const entry = { phone, action, timestamp: new Date().toISOString() };
  const logPath = path.join(__dirname, "patient_logs.json");
  const logs = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath)) : [];
  logs.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
}

// === Start Server ===
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Unified Server running on http://localhost:${PORT}`);
});
