// routes/things.js routing file
"use strict";
const express = require("express");
const isAuthorized = require("../controllers/authorization");
const db = require("../controllers/dbConnection");
let router = express.Router();

// router.use(function(req, res, next) {
//   console.log(req.url, "@", Date.now());
//   next();
// });

// app.get("/person", isAuthorized, (req, res) => {

// });
router.use(isAuthorized);

router
  .route("/")
  .get((req, res) => {
    let profileContact = {};

    db.task(async (t) => {
      const personProfile = await t.one(
        `
      SELECT person.*
      FROM person
      WHERE person.id = $1
      `,
        req.query.personId
      );

      if (personProfile) {
        const contact_person = await t.manyOrNone(
          `
        SELECT person_id, contact_type_id, contact_id, is_active, validation_request_id, email.email, phone_number.phone_number
          FROM contact_person
          LEFT JOIN email 
            ON email.id = contact_id 
            AND contact_type_id = $(type_email)
          LEFT JOIN phone_number 
            ON phone_number.id = contact_id 
            AND contact_type_id = $(type_phone_number)
          WHERE is_active = TRUE
          AND person_id = $(person_id)`,
          { type_email: 1, type_phone_number: 2, person_id: req.query.personId }
        );

        profileContact.contact_person = contact_person ? contact_person : null;

        const person_org = await t.manyOrNone(
          `
          SELECT id, person_id, org_id
          FROM person_org
          WHERE is_active = TRUE
          AND person_id = $1
        `,
          req.query.personId
        );

        let orgIds = [];

        for (
          let i = 0, person_org_items = person_org.length;
          i < person_org_items;
          i++
        ) {
          orgIds.push(person_org[i].id);
        }

        if (orgIds.length) {
          const contact_person_org = await t.manyOrNone(
            `
          SELECT person_org_id, contact_type_id, contact_id, email.email, phone_number.phone_number
          FROM contact_person_org
          LEFT JOIN email ON email.id = contact_id AND contact_type_id = $(type_email)
          LEFT JOIN phone_number ON phone_number.id = contact_id AND contact_type_id = $(type_phone_number)
          WHERE is_active = TRUE
          AND person_org_id IN ($(orgIds:list))
          `,
            { type_email: 1, type_phone_number: 2, orgIds: orgIds }
          );

          profileContact.contact_person_org = contact_person_org;
        }
      }

      const profileTotal = {
        profile: personProfile,
        contact: profileContact,
      };

      return profileTotal;
    })
      .then(function (profileTotal) {
        res.status(200).json({ success: true, data: profileTotal });
      })
      .catch(function (error) {
        //console.log(error);
        if (error.received === 0) {
          res.status(400).json({ success: false, error: "Person not found" });
        }
      });
  })
  .post((req, res) => {
    // const payload = {
    //   id: 1,
    //   pre_degree: "mgr.",
    //   surname: "hajny",
    //   names: "karel",
    //   post_degree: "",
    //   birthday_date: "1988-08-05",
    //   public_note: "",
    //   private_note: "soukroma",
    // };

    const reqData = req.body;

    const inputData = {
      id: reqData.id ? reqData.id : null,
      pre_degree: reqData.pre_degree ? reqData.pre_degree : null,
      surname: reqData.surname,
      names: reqData.names ? reqData.names.split(", ") : null,
      post_degree: reqData.post_degree ? reqData.post_degree : null,
      birthday_date: reqData.birthday_date ? reqData.birthday_date : null,
      public_note: reqData.public_note ? reqData.public_note : null,
      private_note: reqData.private_note ? reqData.private_note : null,
      created_by_role_id: req.app_user_role_id ? req.app_user_role_id : 1,
    };

    if (inputData.id === "new") {
      db.one(
        `INSERT INTO person
          ("pre_degree", "surname", "names", "post_degree", "birthday_date", "public_note","private_note", "created_by_role_id")
    
          VALUES
          ($(pre_degree), $(surname), $(names), $(post_degree), $(birthday_date), $(public_note), $(private_note), $(created_by_role_id))
    
          RETURNING person.id;`,
        inputData
      )
        .then(function (data) {
          if (data.id !== null && !isNaN(data.id)) {
            return res.status(201).json({success: true, person_id:data.id});
          } else {
            return res.status(500).json({ error: "DB problem" });
          }
        })
        .catch(function (error) {
          //console.log("ERROR:", error);
          return res.status(500).json({ error: "Connection failed" });
        });
    } else {
      db.result(
        `UPDATE person 
        SET "pre_degree" = $(pre_degree), 
            "surname" = $(surname), 
            "names" = $(names), 
            "post_degree" = $(post_degree), 
            "birthday_date" = $(birthday_date), 
            "public_note" = $(public_note), 
            "private_note" = $(private_note)
        WHERE id = $(id)`, inputData, r => r.rowCount
      ).then(count => {
        if (count < 1) return res.status(500).json({ error: "DB problem" });
        return res.status(200).json({success:true});
     })
     .catch(error => {
      return res.status(500).json({ error: "Connection failed" });
     });
    }
  });

router
  .route("/list")
  .get((req, res) => {
    db.manyOrNone(
      `SELECT person.id, names, surname, string_agg(org.name, ', ') orglist
      FROM afatoga.person
      LEFT OUTER JOIN afatoga.person_org ON person.id = person_org.person_id
      LEFT OUTER JOIN afatoga.org ON person_org.org_id = org.id
      GROUP BY person.id
      LIMIT 10
      `
    )
      .then(function (data) {
        res.status(200).json(data);
      })
      .catch(function (error) {
        //console.log('ERROR:', error);
        // received = result.rows.length
        res.status(500).json({ success: false, error: "Connection failed" });
      });
  });

module.exports = router;
//res.send("hi get /things/cars/" + req.params.carid);
