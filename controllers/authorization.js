"use strict";
const jwt = require("jsonwebtoken");

module.exports = function isAuthorized(req, res, next) {
  if (typeof req.headers.authorization !== "undefined") {
    // retrieve the authorization header and parse out the
    // JWT using the split function
    let token = req.headers.authorization.split(" ")[1];

    //let privateKey = fs.readFileSync('./private.pem', 'utf8');
    // Here we validate that the JSON Web Token is valid and has been
    // created using the same private pass phrase
    jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithm: "HS256" },
      (err, user) => {
        // if there has been an error...
        if (err) {
          // shut them out!
          res.status(401).json({ success: false, error: "Not Authorized" });
        }
        // if the JWT is valid, allow them to hit
        // the intended endpoint
        req.app_user_role_id = user.role_id;
        return next();
      }
    );
  } else {
    // No authorization header exists on the incoming
    // request, return not authorized
    return res.status(500).json({ success: false, error: "Not Authorized" });
  }
};
