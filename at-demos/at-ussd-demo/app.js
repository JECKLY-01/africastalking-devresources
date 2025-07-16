const express = require("express");
const ussdRoute = require("./index"); // Assuming 'index.js' has your router
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware must come first
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Use your USSD route
app.use("/", ussdRoute);

// Start the server AFTER setting everything up
app.listen(PORT, () => console.log(`Server running on localhost:${PORT}`));
