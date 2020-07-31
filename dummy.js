// let's first add a /secret api endpoint that we will be protecting
app.get("/secret", isAuthorized, (req, res) => {
    return res.json({ message: "THIS IS SUPER SECRET, DO NOT SHARE!" });
  });
  
  // and a /readme endpoint which will be open for the world to see
  app.get("/readme", (req, res) => {
    return res.json({ message: "This is open to the world!" });
  });

  
  app.post("/api/login", (req, res) => {
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
  
  app.get("/api/personList", isAuthorized, (req, res) => {
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
  
  app.get("/api/person", isAuthorized, (req, res) => {
    let profileContact = {};
  
    db.task(async (t) => {
      const personProfile = await t.one(
        `
        SELECT person.*
        FROM afatoga.person
        WHERE person.id = $1
        `,
        req.query.personId
      );
  
      if (personProfile) {
        const contact_person = await t.manyOrNone(
          `
          SELECT person_id, contact_type_id, contact_id, is_active, validation_request_id, email.email, phone_number.phone_number
            FROM afatoga.contact_person
            LEFT JOIN afatoga.email 
              ON email.id = contact_id 
              AND contact_type_id = $(type_email)
            LEFT JOIN afatoga.phone_number 
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
            FROM afatoga.person_org
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
            FROM afatoga.contact_person_org
            LEFT JOIN afatoga.email ON email.id = contact_id AND contact_type_id = $(type_email)
            LEFT JOIN afatoga.phone_number ON phone_number.id = contact_id AND contact_type_id = $(type_phone_number)
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
        /*if (data.id !== undefined && !isNaN(data.id)) {
          res.status(200).json({ success: true, data: data });
        }*/
      })
      .catch(function (error) {
        //console.log(error);
        if (error.received === 0) {
          res.status(400).json({ success: false, error: "Person not found" });
        }
      });
  });
  
  app.post("/api/person/contact_person", isAuthorized, (req, res) => {
    const reqData = req.body;
    let returningData = {};
  
    db.task(async (t) => {
      if (reqData.contact_item_id === undefined) {
        const currentDBData = await t.oneOrNone(
          `SELECT id FROM afatoga.$(contact_type_name~) 
          WHERE $(contact_type_name~) = $(value)`,
          {
            contact_type_name: reqData.contact_type_name,
            value: reqData.contact_value,
          }
        );
          // if selects 0 rows..then its null
        if (currentDBData !== null && !isNaN(currentDBData.id)) {
          return res.status(403).json({ success: false, error: "Contact already exists" });
        }
  
        const response = await t.oneOrNone(
          `INSERT INTO afatoga.$(contact_type_name~) 
          ($(contact_type_name~)) 
          VALUES 
          ($(value))
          RETURNING afatoga.$(contact_type_name~).id`,
          {
            contact_type_name: reqData.contact_type_name,
            value: reqData.contact_value,
          }
        );
  
        const contact_type_id = reqData.contact_type_name === "email" ? 1 : 2;
        if (response.id > 0) {
          returningData = {
            person_id: reqData.person_id,
            contact_type_id: contact_type_id,
            contact_id: response.id,
          };
  
          await t.none(
            `INSERT INTO afatoga.contact_person 
            ("person_id", "contact_type_id", "contact_id") 
            VALUES 
            ($(person_id), $(contact_type_id), $(contact_id))`,
            returningData
          );
        } else {
          return res.status(400).json({ success: false, error: "Unable to save item" });
        }
      } else {
        const response = await t.oneOrNone(
          `INSERT INTO afatoga.validation_log ("relation_table_name","item_id") VALUES ($(tableName), $(itemId)) RETURNING afatoga.validation_log.id`,
          {
            tableName: "contact_person",
            itemId: reqData.contact_item_id,
          }
        );
  
        returningData = { validation_request_id: reponse.id };
  
        await t.none(
          `UPDATE afatoga.contact_person SET validation_request_id = $(validation_request_id) WHERE person_id = $(person_id) AND contact_id = $(contact_item_id)`,
          {
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
  
  app.post("/api/person", isAuthorized, (req, res) => {
    const payload = {
      id: 1,
      pre_degree: "mgr.",
      surname: "hajny",
      names: "karel",
      post_degree: "",
      email: "ok@test.cz",
      phone_number: "555",
      birthday_date: "1988-08-05",
      //"public_note": "",
      private_note: "soukroma",
    };
  
    const reqData = payload; //req.body;
    //transfrom names into array
    const names = [reqData.names];
  
    const inputData = {
      id: reqData.id ? reqData.id : null,
      pre_degree: reqData.pre_degree ? reqData.pre_degree : null,
      surname: reqData.surname,
      names: names,
      post_degree: reqData.post_degree ? reqData.post_degree : null,
      email: reqData.email,
      phone_number: reqData.phone_number,
      birthday_date: reqData.birthday_date ? reqData.birthday_date : null,
      public_note: reqData.public_note ? reqData.public_note : null,
      private_note: reqData.private_note ? reqData.private_note : null,
      created_by_role_id: reqData.role_id ? reqData.role_id : 1, //get from current user (frontend profile)
    };
  
    if (inputData.id === null) {
      db.one(
        `INSERT INTO afatoga.person
        ("pre_degree", "surname", "names", "post_degree", "birthday_date", "public_note","private_note", "created_by_role_id")
  
        VALUES
        ($(pre_degree), $(surname), $(names), $(post_degree), $(birthday_date), $(public_note), $(private_note), $(created_by_role_id))
  
        RETURNING afatoga.person.id;`,
        inputData
      )
        .then(function (data) {
          if (data !== null && !isNaN(data.id)) {
            return res.status(200).json("success");
          } else {
            return res.status(500).json({ error: "Connection problem" });
          }
        })
        .catch(function (error) {
          //console.log("ERROR:", error);
          return res.status(500).json({ error: "Connection failed" });
        });
    } else {
      db.task(async (t) => {
        //returns two rows...
        // const currentPersonData = await t.one(
        //   ``,
        //   inputData.id
        // );
  
        await t.none(
          `UPDATE afatoga.person
    
          SET pre_degree = $(pre_degree),
          surname = $(surname),
          names = $(names),
          post_degree = $(post_degree),
          birthday_date = $(birthday_date),
          public_note = $(public_note),
          private_note = $(private_note)
    
          WHERE id = $(id)`,
          inputData
        );
  
        if (inputData.email !== currentPersonData.email) {
          await t.none(
            `UPDATE afatoga.contact_person SET is_active = $1 WHERE contact_type_id = $2 AND person_id = $3`,
            [false, 1, inputData.id]
          );
  
          const data = await t.one(
            `INSERT INTO afatoga.$(contact_type_name~) ($(contact_type_name~)) VALUES ($(value)) RETURNING afatoga.$(contact_type_name~).id`,
            {
              contact_type_name: inputData.contact_type_name,
              value: inputData.email,
            }
          );
          if (!isNaN(data.id)) {
            await t.none(
              `INSERT INTO afatoga.contact_person 
              ("person_id", "contact_type_id", "contact_id") 
              VALUES 
              ($(person_id), $(contact_type_id), $(contact_id))`,
              { person_id: inputData.id, contact_type_id: 1, contact_id: data.id }
            );
          }
        }
        if (inputData.phone_number !== currentPersonData.phone_number) {
          await t.none(
            `UPDATE afatoga.contact_person 
            SET is_active = $1
            WHERE contact_type_id = $2
            AND person_id = $3`,
            [false, 2, inputData.id]
          );
          const data = await t.one(
            `INSERT INTO afatoga.phone_number ("phone_number") VALUES ($1) RETURNING afatoga.phone_number.id`,
            inputData.phone_number
          );
  
          if (!isNaN(data.id)) {
            await t.none(
              `INSERT INTO afatoga.contact_person 
              ("person_id", "contact_type_id", "contact_id") 
              VALUES 
              ($(person_id), $(contact_type_id), $(contact_id))`,
              { person_id: inputData.id, contact_type_id: 1, contact_id: data.id }
            );
          }
        }
      })
        .then(() => {
          return res.status(200).json({ success: true, data: inputData });
        })
        .catch((error) => {
          console.log("ERROR:", error);
          return res.status(500).json({ error: "Connection failed" });
        });
    }
  });
  


  
// db.one(
//   `SELECT person.*, email.email, phone_number.phone_number
//   FROM afatoga.person
//   LEFT JOIN afatoga.contact_person ON person.id = contact_person.person_id
//   LEFT JOIN afatoga.email ON contact_person.contact_id = email.id
//   LEFT JOIN afatoga.phone_number ON contact_person.contact_id = phone_number.id
//   WHERE person.id = $(1)
//   AND contact_person.is_active = true`,
//   inputData.id
// )

//   db.one(
//     `UPDATE afatoga.person

//     SET pre_degree = $(pre_degree),
//     surname = $(surname),
//     names = $(names),
//     post_degree = $(post_degree),
//     birthday_date = $(birthday_date),
//     public_note = $(public_note),
//     private_note = $(private_note)

//     WHERE id = $(id)
//     RETURNING afatoga.person.id;`,
//     inputData
//   )
//     .then(function () {
//       db.none("UPDATE afatoga.contact_person SET is_active = $1", false);
//     })
//     .then(function () {
//       db.one(
//           'INSERT INTO afatoga.email ("email") VALUES ($1) RETURNING afatoga.email.id',
//           inputData.email
//       )
//       .then (function (data) {
//         emailId = data.id;
//         console.log(emailId);
//         db.none(
//           `INSERT INTO afatoga.contact_person
//           ("person_id", "contact_type_id", "contact_id")

//           VALUES
//           ($(id), $(contact_type_id), $(contact_id))`,
//           { id: inputData.id, contact_type_id: 1, contact_id: emailId }
//         )
//         .then (function () {
//           res.status(200).json({ success: true, data: inputData });
//         });
//       });
//     })
//     // .then(function () {

//     // })
//     .catch(function (error) {
//       console.log("ERROR:", error);
//       res.status(500).json({ error: "Connection failed" });
//     });
// }
