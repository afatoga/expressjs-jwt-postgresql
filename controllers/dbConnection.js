"use strict";

const dotenv = require("dotenv");
dotenv.config();
const monitor = require("pg-monitor");

const initOptions = {
 schema: 'afatoga',
};
monitor.attach(initOptions);
const pgp = require("pg-promise")(initOptions);
const cn = {
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PW,
  max: 30, // use up to 30 connections
};

const db = pgp(cn);

// module.exports = function loadDb(req, res, next) {
//   if (req.db === undefined) {
//     req.db = pgp(cn);
//   }
//   next();
// }

module.exports = db;
