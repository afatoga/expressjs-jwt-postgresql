"use strict";
const express = require("express");
let router = express.Router();
const db = require("../controllers/dbConnection");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// middleware that is specific to this router
// router.use(function timeLog (req, res, next) {
//   console.log('Time: ', Date.now())
//   next()
// })
// define the home page route

router
  .post("/login", (req, res) => {
    const email = req.body.email.toLowerCase();
    db.one(`SELECT password, role_id FROM app_user WHERE email = $1`, email)
      .then(function (data) {
        if (bcrypt.compareSync(req.body.password, data.password)) {
          let token = jwt.sign(
              //check if role id is in token
            { app: "contacts-realm",
              role_id: data.role_id},
            process.env.JWT_SECRET,
            { algorithm: "HS256", expiresIn: "2d" }
          );
          res.status(200).json({
            token: token,
            email: email,
            /*name: email,*/ role_id: data.role_id,
          });
        } else {
          res
            .status(403)
            .json({ success: false, error: "E-mail or password is wrong" });
        }
      })
      .catch(function (error) {
        //console.log('ERROR:', error);
        // received = result.rows.length
        if (error.received === 0) {
          res
            .status(400)
            .json({ success: false, error: "Invalid credentials" });
          return;
        }
        res.status(500).json({ success: false, error: "Connection failed" });
      });
  })
  .post("/register", (req, res) => {
    if (req.body["password"] === undefined || req.body["email"] === undefined) {
      return res
        .status(400)
        .json({ error: "Email and password are mandatory" });
    }

    const email = req.body["email"].trim();
    const emailCheck = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

    if (!emailCheck.test(email)) {
      return res.status(400).json({ error: "Email is not valid" });
    }
    db.task(async (t) => {
        const emailExists = await t.oneOrNone(`
                                    SELECT email FROM app_user WHERE email = $1
                                    `, email);
        if (emailExists) return res.status(403).json({ error: "E-mail exists" });

        const hash = await bcrypt.hash(req.body["password"], 10);
        const user = await t.oneOrNone(
            `INSERT INTO app_user (email, password, role_id) VALUES ($(email), $(password), 1) RETURNING app_user.id`,
            {
              email: email,
              password: hash,
            }
        );
        if (user.id !== undefined && !isNaN(user.id)) {
            return res.status(201).json({ success: true});
          }
          
        return res.status(500).json({success:false, error:"DB error"});
    }).catch(function (error) {
        //console.log("ERROR:", error);
        return res.status(500).json({ error: "Connection failed" });
      });

  });
// // define the about route
// router.get('/about', function (req, res) {
//   res.send('About birds')
// })

module.exports = router;
