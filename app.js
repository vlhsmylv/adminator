const express = require("express");
const dotenv = require("dotenv");
const main = require("./main"); // Require the main.js file

// Initialize dotenv to use .env file variables
dotenv.config();

// Get the port from .env or default to 3000
const PORT = process.env.PORT || 3000;

// Initialize Express
const app = express();

// Set EJS as the template engine
app.set("view engine", "ejs");
app.set("views", "./public"); // Set the views directory to ./public

// Generated schema

// Define the root route
app.get("/", (_req, res) => {
  // Pass parsed schema from main.js to the EJS template
  res.render("index", { schema: main() });
});

// Start the HTTP server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
