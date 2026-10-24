ALTER TABLE ff_customers ADD COLUMN postal_code VARCHAR(32) NOT NULL DEFAULT '';

CREATE TABLE ff_global_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision VARCHAR(128) NOT NULL,
    industries TEXT NOT NULL
);

INSERT INTO ff_global_settings (id, revision, industries) VALUES
    (1, 'initial-industries-v1', '["IT & Software","Handel & E-Commerce","Industrie & Produktion","Handwerk & Bau","Beratung & Dienstleistungen","Gesundheit & Soziales","Bildung & Forschung","Finanzen & Versicherungen","Medien & Kommunikation","Transport & Logistik","Öffentlicher Dienst","Sonstige"]');
