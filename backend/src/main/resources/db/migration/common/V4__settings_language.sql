ALTER TABLE ff_settings
    ADD COLUMN language VARCHAR(2) NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'en'));
