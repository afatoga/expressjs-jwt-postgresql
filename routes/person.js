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
      `SELECT person.id, names, surname, contact_email.email, contact_phone.phone_number, org_join.orglist
      FROM person
      LEFT JOIN (SELECT DISTINCT ON (contact_person.person_id) 
                  contact_person.person_id, email.email 
                FROM contact_person
                LEFT JOIN email ON contact_person.contact_id = email.id AND contact_type_id = 1
                WHERE email IS NOT NULL) as contact_email ON contact_email.person_id = person.id
      LEFT JOIN (SELECT DISTINCT ON (contact_person.person_id) 
                  contact_person.person_id, phone_number.phone_number 
                FROM contact_person
                LEFT JOIN phone_number ON contact_person.contact_id = phone_number.id AND contact_type_id = 2
                WHERE phone_number IS NOT NULL) as contact_phone ON contact_phone.person_id = person.id
      LEFT JOIN (SELECT person_id, string_agg(org.name, ', ') orglist
                 FROM person_org
                 LEFT OUTER JOIN org ON person_org.org_id = org.id
                 GROUP BY person_id) as org_join ON org_join.person_id = person.id
      ORDER BY person.id
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

  router
  .route("/contact_item")
  .post((req, res) => {
    const reqData = req.body;
    let returningData = {};
  
    db.task(async (t) => {
      if (reqData.action === "save") {
        // check duplicity
        const currentDBData = await t.oneOrNone(
          `SELECT id FROM $(contact_type_name~) 
          WHERE $(contact_type_name~) = $(value)`,
          {
            contact_type_name: reqData.contact_type_name,
            value: reqData.contact_value,
          }
        );
          // if selects 0 rows, then currentDBData = null
        if (currentDBData !== null && !isNaN(currentDBData.id)) {
          return res.status(403).json({ success: false, error: "Contact already exists" });
        }
  
        const response = await t.oneOrNone(
          `INSERT INTO $(contact_type_name~) 
          ($(contact_type_name~)) 
          VALUES 
          ($(value))
          RETURNING $(contact_type_name~).id`,
          {
            contact_type_name: reqData.contact_type_name,
            value: reqData.contact_value,
          }
        );
        // env: 1, 2, 3; describe what these numbers mean
        const contact_type_id = reqData.contact_type_name === "email" ? 1 : 2;
        if (response.id > 0) {
          returningData = {
            person_id: reqData.person_id,
            contact_type_id: contact_type_id,
            contact_id: response.id,
            contact_table_name: reqData.table_name
          };
  
          await t.none(
            `INSERT INTO $(contact_table_name~) 
            ("person_id", "contact_type_id", "contact_id") 
            VALUES 
            ($(person_id), $(contact_type_id), $(contact_id))`,
            returningData
          );
        } else {
          // error while saving
          return res.status(400).json({ success: false, error: "Unable to save item" });
        }
      } else if (reqData.action === "validate") {
        const response = await t.oneOrNone(
          `INSERT INTO validation_log ("relation_table_name","item_id") VALUES ($(contact_table_name), $(itemId)) RETURNING validation_log.id`,
          {
            contact_table_name: reqData.table_name,
            itemId: reqData.contact_item_id,
          }
        );
  
        returningData = { validation_request_id: response.id };
  
        await t.none(
          `UPDATE $(contact_table_name~) SET validation_request_id = $(validation_request_id) WHERE person_id = $(person_id) AND contact_id = $(contact_item_id)`,
          {
            contact_table_name: reqData.table_name,
            validation_request_id: response.id,
            person_id: reqData.person_id,
            contact_item_id: reqData.contact_item_id,
          }
        );
      }
    })
      .then(() => {
        return res.status(200).json({ success: true, data: returningData });
      })
      .catch((error) => {
        console.log("ERROR:", error);
        return res.status(500).json({ error: "Connection failed" });
      });
  });

module.exports = router;
//res.send("hi get /things/cars/" + req.params.carid);



// `SELECT person.id, names, surname, string_agg(org.name, ', ') orglist, email.email
//       FROM person
//       LEFT OUTER JOIN person_org ON person.id = person_org.person_id
//       LEFT OUTER JOIN org ON person_org.org_id = org.id
//       INNER JOIN contact_person ON contact_person.person_id = person.id
//       INNER JOIN email ON contact_person.contact_id = email.id
//       GROUP BY person.id, email.email
//       LIMIT 10
//       `

// LEFT JOIN (SELECT contact_person.person_id, phone_number.phone_number
//   FROM contact_person
//   LEFT JOIN phone_number ON contact_person.contact_id = phone_number.id
//   WHERE contact_type_id = 2
//   LIMIT 1) as contact_phone ON contact_phone.person_id = person.id