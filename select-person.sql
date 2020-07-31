SELECT person.*, string_agg(contact_person.email, ', ') cp_email, string_agg(contact_person.phone_number, ', ') cp_phone_number, person_org.name
FROM afatoga.person
LEFT JOIN 
     (SELECT contact_person.person_id, email.email, phone_number.phone_number
      FROM contact_person
      LEFT JOIN afatoga.email ON contact_person.contact_id = email.id
      LEFT JOIN afatoga.phone_number ON contact_person.contact_id = phone_number.id
      WHERE contact_person.is_active = true) contact_person
ON person.id = contact_person.person_id
LEFT JOIN 
     (SELECT person_org.person_id, org.name
      FROM person_org
      LEFT JOIN afatoga.org ON person_org.org_id = org.id
      LEFT JOIN 
      (SELECT contact_person_org.id, email.email, phone_number.phone_number
      FROM contact_person_org
      LEFT JOIN afatoga.email ON contact_person_org.contact_id = email.id
      LEFT JOIN afatoga.phone_number ON contact_person_org.contact_id = phone_number.id
		) contact_person_org
		ON person_org.id = contact_person_org.id
		WHERE person_org.is_active = true) person_org
ON person.id = person_org.person_id
WHERE person.id = 1
GROUP BY person.id

/* working example, contact_person concat */

/* first part */

SELECT contact_person.person_id, string_agg(email.email, ', ') cp_email, string_agg(phone_number.phone_number, ', ') cp_phone_number
FROM contact_person
LEFT JOIN afatoga.email ON contact_person.contact_id = email.id AND contact_person.contact_type_id = 1
LEFT JOIN afatoga.phone_number ON contact_person.contact_id = phone_number.id AND contact_person.contact_type_id = 2
WHERE contact_person.is_active = TRUE
GROUP BY contact_person.person_id

/* first part ends */

SELECT person.*, contact_person.cp_email, contact_person.cp_phone_number
FROM afatoga.person
LEFT JOIN 
     (SELECT contact_person.person_id, string_agg(email.email, ', ') cp_email, string_agg(phone_number.phone_number, ', ') cp_phone_number
FROM contact_person
LEFT JOIN afatoga.email ON contact_person.contact_id = email.id AND contact_person.contact_type_id = 1
LEFT JOIN afatoga.phone_number ON contact_person.contact_id = phone_number.id AND contact_person.contact_type_id = 2
WHERE contact_person.is_active = TRUE
GROUP BY contact_person.person_id) contact_person
ON person.id = contact_person.person_id
WHERE person.id = 1

/* person employed by two orgs */
SELECT person.*, contact_person.cp_email, contact_person.cp_phone_number, person_org.name
FROM afatoga.person
LEFT JOIN 
     (SELECT contact_person.person_id, string_agg(email.email, ', ') cp_email, string_agg(phone_number.phone_number, ', ') cp_phone_number
FROM contact_person
LEFT JOIN afatoga.email ON contact_person.contact_id = email.id AND contact_person.contact_type_id = 1
LEFT JOIN afatoga.phone_number ON contact_person.contact_id = phone_number.id AND contact_person.contact_type_id = 2
WHERE contact_person.is_active = TRUE
GROUP BY contact_person.person_id) contact_person
ON person.id = contact_person.person_id
LEFT JOIN 
     (SELECT person_org.person_id, org.name
      FROM person_org
      LEFT JOIN afatoga.org ON person_org.org_id = org.id
      LEFT JOIN 
      (SELECT contact_person_org.id, email.email, phone_number.phone_number
      FROM contact_person_org
      LEFT JOIN afatoga.email ON contact_person_org.contact_id = email.id
      LEFT JOIN afatoga.phone_number ON contact_person_org.contact_id = phone_number.id
		) contact_person_org
		ON person_org.id = contact_person_org.id
		WHERE person_org.is_active = true) person_org
ON person.id = person_org.person_id
WHERE person.id = 1

/* */

`SELECT person.*, string_agg(cp.email, ', ') email, string_agg(cp.phone_number, ', ') phone_number
        FROM afatoga.person
        LEFT JOIN 
        (SELECT contact_person.person_id, email.email, phone_number.phone_number
          FROM contact_person
        LEFT JOIN afatoga.email ON contact_person.contact_id = email.id
        LEFT JOIN afatoga.phone_number ON contact_person.contact_id = phone_number.id
        WHERE contact_person.is_active = true) cp
      ON person.id = cp.person_id
        WHERE person.id = $1
        GROUP BY person.id
        `