package de.forgeflow.workspace;

import java.text.Normalizer;
import java.util.*;
import jakarta.validation.constraints.*;
import de.forgeflow.api.ApiFailure;

/** Application-wide selectable values, independent of account preferences and workspace revisions. */
public record GlobalSettings(@NotBlank @Size(max=128) String revision,
        @NotNull @Size(min=1, max=100) List<@NotBlank @Size(max=100) String> industries,
        @NotNull @Size(min=1, max=12) List<@NotBlank @Size(max=32) String> visibleApps,
        @NotNull @Size(max=12) List<@NotBlank @Size(max=32) String> aiApps) {
    private static final Set<String> APPS = Set.of("projectManager", "git", "wiki", "devTools", "timeTracker", "business", "cloud", "knowledgeHub", "flowPilot", "pulseWatch", "dataScout", "requestLab");
    public GlobalSettings {
        if (industries != null) industries = List.copyOf(industries);
        if (visibleApps != null) visibleApps = List.copyOf(visibleApps);
        if (aiApps != null) aiApps = List.copyOf(aiApps);
    }
    public GlobalSettings(String revision, List<String> industries) {
        this(revision, industries, defaultVisibleApps(), List.of("projectManager"));
    }
    public static GlobalSettings defaults() {
        return new GlobalSettings("initial-industries-v1", List.of("IT & Software", "Handel & E-Commerce", "Industrie & Produktion", "Handwerk & Bau",
            "Beratung & Dienstleistungen", "Gesundheit & Soziales", "Bildung & Forschung", "Finanzen & Versicherungen", "Medien & Kommunikation", "Transport & Logistik", "Öffentlicher Dienst", "Sonstige"),
            defaultVisibleApps(), List.of("projectManager"));
    }
    public static List<String> defaultVisibleApps() {
        return List.of("projectManager", "git", "wiki", "devTools", "timeTracker", "business", "cloud", "knowledgeHub", "flowPilot", "pulseWatch", "dataScout", "requestLab");
    }
    public GlobalSettings normalized() {
        if (industries == null || industries.isEmpty() || industries.size() > 100) throw invalid();
        var result = new ArrayList<String>(); var seen = new HashSet<String>();
        for (String value : industries) {
            if (value == null) throw invalid();
            String name = Normalizer.normalize(value.strip(), Normalizer.Form.NFC);
            if (name.isBlank() || name.length() > 100 || name.codePoints().anyMatch(code -> Character.isISOControl(code)) || !seen.add(name.toLowerCase(Locale.ROOT))) throw invalid();
            result.add(name);
        }
        if (!validApps(visibleApps, false) || !validApps(aiApps, true)) throw invalid();
        return new GlobalSettings(revision, result, visibleApps, aiApps);
    }
    private static boolean validApps(List<String> values, boolean allowEmpty) {
        return values != null && (allowEmpty || !values.isEmpty()) && values.size() <= APPS.size()
            && values.stream().allMatch(APPS::contains) && new HashSet<>(values).size() == values.size();
    }
    private static ApiFailure invalid() { return new ApiFailure(422, "INVALID_GLOBAL_SETTINGS", "Bitte 1 bis 100 eindeutige Branchen mit jeweils höchstens 100 Zeichen angeben."); }
}
