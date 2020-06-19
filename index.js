const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();

const dotenv = require('dotenv');
dotenv.config();

//const port = 3939;
const jwt = require("jsonwebtoken");
//const fs = require('fs');
const bcrypt = require('bcrypt');

const pgp = require('pg-promise')(/* options */)
const db = pgp(`postgres://${process.env.DB_NAME}:${process.env.DB_PW}@${process.env.DB_HOST}/${process.env.DB_NAME}`);

app.use(cors());
app.use(bodyParser.json())
app.get('/', (req, res) => res.send('Hello World!'))

// let's first add a /secret api endpoint that we will be protecting
app.get('/secret', isAuthorized, (req, res) => {
    res.json({ "message" : "THIS IS SUPER SECRET, DO NOT SHARE!" })
})

// and a /readme endpoint which will be open for the world to see 
app.get('/readme', (req, res) => {
    res.json({ "message" : "This is open to the world!" })
})

app.post('/api/register', (req, res) => {

    if (req.body['password'] === undefined || req.body['email'] === undefined) 
    {
        res.status(400).json({error: "Email and password are mandatory"});
        return;
    }

    const email = req.body['email'].trim();
    const emailCheck=/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

    if (!emailCheck.test(email)) {
        res.status(400).json({error: "Email is not valid"});
        return;
    }

    bcrypt.hash(req.body['password'], 10, function(err, hash) {
        db.one('INSERT INTO afatoga.user (email, password, role_id) VALUES (${email}, ${password}, 1) RETURNING afatoga.user.id', {
            email: email,
            password: hash
        })
        .then(function (data) {
            if (data.id !== undefined && !isNaN(data.id)) {
                res.status(200).send('success');
            } else {
                res.status(500).json({error: "Connection problem"});
            }
        })
        .catch(function (error) {
            console.log('ERROR:', error);
            res.status(500).json({ error: "Connection failed" });
        })
    });

});

app.post('/api/login', (req, res) => {

    db.one('SELECT password, role_id FROM afatoga.user WHERE email = $1', req.body.email)
    .then(function (data) {
        if (bcrypt.compareSync(req.body.password, data.password)) {
            //let privateKey = fs.readFileSync('./private.pem', 'utf8');
            let token = jwt.sign({ "body": "contacts-realm" }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '2d'});
            res.status(200).json({token: token, email: req.body.email, /*name: req.body.email,*/ role_id: data.role_id});
        } else {
            res.status(500).json({ error: "Username or password is wrong" });
        }
    })
    .catch(function (error) {
        console.log('ERROR:', error);
        res.status(500).json({ error: "Connection failed" });
    })
})

app.post('/api/person', isAuthorized, (req, res) => {
    
    const payload = {
        "pre_degree": "mgr.",
        "surname": "kohout",
        "names": "petr",
        "post_degree": "",
        "birthday_date": "1970-08-08",
        //"public_note": "",
        "private_note": "soukroma"
    }

    const reqData = payload;//req.body;
    //transfrom names into array
    const names = [reqData.names];

    const inputData = {
        pre_degree: reqData.pre_degree ? reqData.pre_degree : null,
        surname: reqData.surname,
        names: names,
        post_degree: reqData.post_degree ? reqData.post_degree : null,
        birthday_date: reqData.birthday_date ? reqData.birthday_date : null,
        public_note: reqData.public_note ? reqData.public_note : null,
        private_note: reqData.private_note ? reqData.private_note : null,
        created_by_role_id: reqData.role_id ? reqData.role_id : 1 //get from current user (frontend profile)
    }

    db.one('INSERT INTO afatoga.person ("pre_degree", "surname", "names", "post_degree", "birthday_date", "public_note","private_note", "created_by_role_id") VALUES (${pre_degree}, ${surname}, ${names}, ${post_degree}, ${birthday_date}, ${public_note}, ${private_note}, ${created_by_role_id}) RETURNING afatoga.person.id;', inputData)
    .then(function (data) {
        if (data.id !== undefined && !isNaN(data.id)) {
            res.status(200).send('success');
        } else {
            res.status(500).json({error: "Connection problem"});
        }
    })
    .catch(function (error) {
        console.log('ERROR:', error);
        res.status(500).json({ error: "Connection failed" });
    })
})

function isAuthorized(req, res, next) {
    if (typeof req.headers.authorization !== "undefined") {
        // retrieve the authorization header and parse out the
        // JWT using the split function
        let token = req.headers.authorization.split(" ")[1];
        
        //let privateKey = fs.readFileSync('./private.pem', 'utf8');
        // Here we validate that the JSON Web Token is valid and has been 
        // created using the same private pass phrase
        jwt.verify(token, process.env.JWT_SECRET, { algorithm: "HS256" }, (err, user) => {
            
            // if there has been an error...
            if (err) {  
                // shut them out!
                res.status(500).json({ error: "Not Authorized" });
            }
            // if the JWT is valid, allow them to hit
            // the intended endpoint
            return next();
        });
    } else {
        // No authorization header exists on the incoming
        // request, return not authorized
        res.status(500).json({ error: "Not Authorized" });
    }
}

app.listen(process.env.PORT, 
    () => console.log(`Express app listening on port ${process.env.PORT}!`))