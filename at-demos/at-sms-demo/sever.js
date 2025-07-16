const express = require("express");
const bodyParser = require("body-parser");
const AfricasTalking = require("africastalking");
const cron = require("node-cron"); // <-- for automation

// === Initialize Africa's Talking (LIVE MODE) ===
const africastalking = AfricasTalking({
  apiKey: 'atsk_c165305e8a6f3ce6b07a588885c7d06cd72b5e97b4badf93e515f7d4fc053e160df50346',
  username: 'jeckly'
});

const sms = africastalking.SMS;
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// === Sample Patient Data ===
const patients = [
  {
    name: "John Mwangi",
    county: "Nyeri",
    phone: "+254714938333",
    appointment: "2025-07-03T17:13",
    language: "en"
  },
  {
    name: "John Mwangi",
    county: "Nyeri",
    phone: "+254714938333",
    appointment: "2025-07-03T17:18",
    language: "en"
  },
  {
    name: "Amina Hassan",
    county: "Garissa",
    phone: "+254722000002",
    appointment: "2025-07-03T15:28",
    language: "sw"
  }
];

// === Utility: Check if Appointment is Within 10 Minutes ===
function isWithin10Minutes(appointmentTime) {
  const now = new Date();
  const appt = new Date(appointmentTime);
  const diff = appt - now;
  return diff > 0 && diff <= 10 * 60 * 1000;
}

// === Function to Send Reminders ===
async function sendReminders() {
  const reminders = patients.filter(p => isWithin10Minutes(p.appointment));
  const results = [];

  for (const patient of reminders) {
    const message = `Hello ${patient.name}, reminder: Your clinic appointment is on ${patient.appointment} in ${patient.county}. Dial *384*123# to confirm.`;

    try {
      const result = await sms.send({
        to: [patient.phone],
        message,
        from: 'AFTKNG',
        enqueue: true
      });
      results.push({ phone: patient.phone, status: "sent", result });
      console.log(`✅ Sent to ${patient.phone}`);
    } catch (err) {
      results.push({ phone: patient.phone, status: "error", error: err.toString() });
      console.error(`❌ Error sending to ${patient.phone}:`, err.toString());
    }
  }

  return results;
}

// === Run Every Minute ===
cron.schedule("* * * * *", async () => {
  console.log("⏰ Running reminder job...");
  await sendReminders();
});

// === Test Route (Optional) ===
app.post("/send-reminders", async (req, res) => {
  const results = await sendReminders();
  res.status(200).json({ status: "completed", results });
});

// === Start Server ===
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
