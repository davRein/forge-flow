package de.forgeflow.workspace;

import java.text.Normalizer;
import java.util.*;
import jakarta.validation.constraints.*;
import de.forgeflow.api.ApiFailure;

/** Application-wide selectable values, independent of account preferences and workspace revisions. */
public record GlobalSettings(@NotBlank @Size(max=128) String revision,
        @NotNull @Size(min=1, max=100) List<@NotBlank @Size(max=100) String> industries) {
    public GlobalSettings { if (industries != null) industries = List.copyOf(industries); }
    public static GlobalSettings defaults() {
        return new GlobalSettings("initial-industries-v1", List.of("IT & Software", "Handel & E-Commerce", "Industrie & Produktion", "Handwerk & Bau",
            "Beratung & Dienstleistungen", "Gesundheit & Soziales", "Bildung & Forschung", "Finanzen & Versicherungen", "Medien & Kommunikation", "Transport & Logistik", "Öffentlicher Dienst", "Sonstige"));
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
        return new GlobalSettings(revision, result);
    }
    private static ApiFailure invalid() { return new ApiFailure(422, "INVALID_GLOBAL_SETTINGS", "Bitte 1 bis 100 eindeutige Branchen mit jeweils höchstens 100 Zeichen angeben."); }
}
