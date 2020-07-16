const dotenv = require("dotenv");
dotenv.config();

const express = require('express');
const router = express.Router();
//const port = 3939;
const jwt = require("jsonwebtoken");
//const fs = require('fs');
const bcrypt = require("bcryptjs");

// middleware that is specific to this router
// router.use(function timeLog (req, res, next) {
//   console.log('Time: ', Date.now())
//   next()
// })
// define the home page route

router.post("/", (req, res) => {
    const email = req.body.email.toLowerCase();
    db.one(`SELECT password, role_id FROM afatoga.user WHERE email = $1`, email)
      .then(function (data) {
        if (bcrypt.compareSync(req.body.password, data.password)) {
          let token = jwt.sign(
            { body: "contacts-realm" },
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
          res.status(400).json({ success: false, error: "Invalid credentials" });
          return;
        }
        res.status(500).json({ success: false, error: "Connection failed" });
      });
  });
// // define the about route
// router.get('/about', function (req, res) {
//   res.send('About birds')
// })

module.exports = router;