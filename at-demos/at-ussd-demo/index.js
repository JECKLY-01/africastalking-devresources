const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const patients = [
  { name: "John Mwangi", county: "Nyeri", phone: "+254711000001", appointment: "2025-07-05 10:00", language: "en" },
  { name: "Amina Hassan", county: "Garissa", phone: "+254722000002", appointment: "2025-07-06 09:30", language: "sw" },
  { name: "Peter Odhiambo", county: "Kisumu", phone: "+254733000003", appointment: "2025-07-06 14:00", language: "en" }
];

const logAction = (phone, action) => {
  const entry = { phone, action, timestamp: new Date().toISOString() };
  const logPath = path.join(__dirname, "patient_logs.json");
  const logs = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath)) : [];
  logs.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
};

router.post("/ussd", (req, res) => {
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

module.exports = router;
