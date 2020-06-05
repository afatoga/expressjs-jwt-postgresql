const express = require('express')
const bodyParser = require('body-parser');
const app = express()
const port = 3000
const jwt = require("jsonwebtoken")
const fs = require('fs')

const pgp = require('pg-promise')(/* options */)
const db = pgp('xxx')

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

app.post('/jwt', (req, res) => {

    db.one('SELECT password FROM public.user WHERE email = $1', req.body.email)
    .then(function (data) {
        //console.log('DATA:', data);
        if (data.password == req.body.password) {
            let privateKey = "abc"; //fs.readFileSync('./private.pem', 'utf8');
            let token = jwt.sign({ "body": "stuff" }, privateKey, { algorithm: 'HS256', expiresIn: '7d'});
            res.send(token);
        } else {
            res.status(500).json({ error: "Username or password is wrong" });
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
        
        let privateKey = "abc"; //fs.readFileSync('./private.pem', 'utf8');
        // Here we validate that the JSON Web Token is valid and has been 
        // created using the same private pass phrase
        jwt.verify(token, privateKey, { algorithm: "HS256" }, (err, user) => {
            
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

app.listen(port, 
    () => console.log(`Simple Express app listening on port ${port}!`))