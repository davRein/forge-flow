ALTER TABLE ff_global_settings
    ADD COLUMN visible_apps TEXT NOT NULL DEFAULT '["projectManager","git","wiki","devTools","timeTracker","business","cloud","knowledgeHub","flowPilot","pulseWatch"]';

ALTER TABLE ff_global_settings
    ADD COLUMN ai_apps TEXT NOT NULL DEFAULT '["projectManager"]';
