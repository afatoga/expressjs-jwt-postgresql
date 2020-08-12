const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const person = require("./routes/person");
const user = require("./routes/user");
//const loadDb = require("./controllers/dbConnection");

app.use(cors());
app.use(bodyParser.json());
//app.use(loadDb);
app.use("/user", user);
app.use("/person", person);

const dotenv = require("dotenv");
dotenv.config();

// //const port = 3939;
// const jwt = require("jsonwebtoken");
// //const fs = require('fs');
// const bcrypt = require("bcrypt");
// const e = require("express");
// const { response } = require("express");

// const initOptions = {
//   // pg-promise initialization options;
// };

// const pgp = require("pg-promise")(initOptions);
// //monitor.attach(initOptions);

// // let query = pgp.as.format(query, values);
// // console.log(query);
// const cn = {
//   host: process.env.DB_HOST,
//   port: 5432,
//   database: process.env.DB_NAME,
//   user: process.env.DB_USER,
//   password: process.env.DB_PW,
//   max: 30, // use up to 30 connections
// };

// const db = pgp(cn);


app.get("/", (req, res) => res.send("Hello World!"));

app.listen(process.env.PORT, () =>
  console.log(`Express app listening on port ${process.env.PORT}!`)
);