package de.forgeflow;

import java.util.ArrayList;
import org.junit.jupiter.api.Test;
import jakarta.validation.Validation;
import de.forgeflow.workspace.GlobalSettings;
import de.forgeflow.ai.PageContexts;
import de.forgeflow.ai.AgentDtos.PageContext;
import static org.assertj.core.api.Assertions.*;

class DataScoutIntegrationTest {
    @Test void dataScoutCanBeSelectedWithoutOverwritingExistingDefaults() {
        var defaults = GlobalSettings.defaults();
        assertThat(defaults.visibleApps()).contains("dataScout");
        var selected = new ArrayList<>(defaults.visibleApps());
        var settings = new GlobalSettings(defaults.revision(), defaults.industries(), selected, defaults.aiApps());
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(settings)).isEmpty();
        }
        assertThat(settings.normalized().visibleApps()).containsExactlyElementsOf(selected);
        selected.add("unknownApp");
        assertThatThrownBy(() -> new GlobalSettings(defaults.revision(), defaults.industries(), selected, defaults.aiApps()).normalized())
            .isInstanceOf(de.forgeflow.api.ApiFailure.class);
    }

    @Test void dataScoutRoutesCarryNoProjectToolsOrIdentity() {
        for (String section : java.util.List.of("dashboard", "collection", "jobs")) {
            var page = new PageContext("/dataScout/" + section, null, null);
            assertThat(PageContexts.requireSupported(page)).isEqualTo(page);
            assertThat(PageContexts.isProjectManager(page)).isFalse();
        }
        assertThatThrownBy(() -> PageContexts.requireSupported(new PageContext("/dataScout/admin", null, null)))
            .isInstanceOf(de.forgeflow.api.ApiFailure.class);
    }
}
