INSERT INTO "afatoga"."app_role" ("name", "capabilities") VALUES ('admin', '{1,1,1}');
INSERT INTO "afatoga"."app_user" ("email", "password", "role_id") VALUES ('himail@email.cz', '$2b$10$H5pHNOIvSYK33DbDBwyGCePi7qpHp/cS34vEjE72/NRtj8x9CbmU6', '1');
INSERT INTO "afatoga"."contact_type" ("name") VALUES ('email');
INSERT INTO "afatoga"."contact_type" ("name") VALUES ('phone_number');