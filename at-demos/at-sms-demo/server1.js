const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const AfricasTalking = require("africastalking");
const cron = require("node-cron");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// === MySQL Database Connection ===
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "", // ← change this
  database: "clinic_system"      // ← ensure this DB exists
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL database");
  }
});

// === Initialize Africa's Talking ===
const africastalking = AfricasTalking({
  apiKey: 'atsk_c165305e8a6f3ce6b07a588885c7d06cd72b5e97b4badf93e515f7d4fc053e160df50346',
  username: 'jeckly'
});

const sms = africastalking.SMS;

// === Fetch Patients with Appointments in 10 Minutes ===
function getPatientsWithUpcomingAppointments(callback) {
  const now = new Date();
  const tenMinutesLater = new Date(now.getTime() + 10 * 60 * 1000);

  const query = `
    SELECT * FROM patients
    WHERE appointment > ? AND appointment <= ?
  `;

  db.query(query, [now, tenMinutesLater], (err, results) => {
    if (err) {
      console.error("❌ Error fetching patients:", err);
      callback([]);
    } else {
      callback(results);
    }
  });
}

// === Send SMS Reminders ===
async function sendReminders() {
  return new Promise((resolve) => {
    getPatientsWithUpcomingAppointments(async (patients) => {
      const results = [];

      for (const patient of patients) {
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

      resolve(results);
    });
  });
}

// === Run Every Minute ===
cron.schedule("* * * * *", async () => {
  console.log("⏰ Running reminder job...");
  await sendReminders();
});

// === Manual Trigger Route ===
app.post("/send-reminders", async (req, res) => {
  const results = await sendReminders();
  res.status(200).json({ status: "completed", results });
});

// === Add Patient Route (Optional) ===
app.post("/add-patient", (req, res) => {
  const { name, county, phone, appointment, language } = req.body;

  const query = `INSERT INTO patients (name, county, phone, appointment, language)
                 VALUES (?, ?, ?, ?, ?)`;

  db.query(query, [name, county, phone, appointment, language], (err, result) => {
    if (err) {
      console.error("❌ Insert failed:", err);
      res.status(500).json({ status: "error", error: err });
    } else {
      res.status(201).json({ status: "success", id: result.insertId });
    }
  });
});

// === Start Server ===
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
