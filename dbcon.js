'use strict';

const dotenv = require("dotenv");
dotenv.config();
const initOptions = {
  // pg-promise initialization options;
};
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
module.exports = db;

// export default function loadDb(request, _response, next) {

//     // dummy db
//     request.db = {
//       users: {
//         findByApiKey: async token => {
//           switch {
//             case (token == '1234') {
//               return {role: 'owner', id: 1234};
//             case (token == '5678') {
//               return {role: 'employee', id: 5678};
//             default:
//               return null; // no user
//           }
//         }
//       }
//     };

//     next();
//   }
