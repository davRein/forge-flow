package de.forgeflow.rest;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.api.ApiFailure;

/** Private request definitions, deliberately outside workspace/AI data. Never executes requests. */
public record RestCollections(@Min(1) @Max(1) int version, @NotBlank @Size(max=128) String revision,
        @NotNull @Size(max=100) List<@NotNull @Valid Collection> collections) {
    public RestCollections { if (collections != null) collections = List.copyOf(collections); }
    public record Collection(@NotNull UUID id, @NotBlank @Size(max=200) String name,
            @NotNull @Size(max=1000) List<@NotNull @Valid SavedRequest> requests) {
        public Collection { if (requests != null) requests = List.copyOf(requests); }
        @Override public String toString() { return "Collection[content=REDACTED]"; }
    }
    public record SavedRequest(@NotNull UUID id, @NotBlank @Size(max=200) String name, @NotNull @Valid Draft draft) {
        @Override public String toString() { return "SavedRequest[content=REDACTED]"; }
    }
    public record Draft(@NotNull @Pattern(regexp="GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS") String method,
            @NotNull @Size(max=4000) String url, @NotNull @Size(max=20000) String headers,
            @NotNull @Size(max=100000) String body, @NotNull @Pattern(regexp="none|json|text") String bodyType,
            @Min(1) @Max(120) int timeout) {
        @Override public String toString() { return "Draft[content=REDACTED]"; }
    }
    @Override public String toString() { return "RestCollections[content=REDACTED]"; }
    public static RestCollections empty() { return new RestCollections(1, "rest-initial", List.of()); }
    public RestCollections withRevision(String value) { return new RestCollections(1, value, collections); }
    public void validate(JsonMapper json) {
        var ids = new HashSet<UUID>(); int requests = 0;
        for (var collection : collections) {
            require(ids.add(collection.id()) && !collection.name().strip().isEmpty());
            for (var request : collection.requests()) {
                require(ids.add(request.id()) && !request.name().strip().isEmpty()); requests++;
                var value = request.draft().url().strip();
                if (!value.isEmpty()) {
                    try { var uri = URI.create(value); require(Set.of("http", "https").contains(uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT)) && uri.getHost() != null && uri.getUserInfo() == null); }
                    catch (IllegalArgumentException invalid) { throw invalid(); }
                }
            }
        }
        require(requests <= 1000);
        if (json.writeValueAsString(this).getBytes(StandardCharsets.UTF_8).length > 1024 * 1024)
            throw new ApiFailure(413, "REST_COLLECTIONS_LIMIT", "Collections dürfen insgesamt höchstens 1 MiB umfassen.");
    }
    private static void require(boolean valid) { if (!valid) throw invalid(); }
    private static ApiFailure invalid() { return new ApiFailure(422, "INVALID_REST_COLLECTIONS", "Bitte gültige, eindeutige Collections und Anfragen angeben. URLs müssen HTTP(S) verwenden und dürfen keine Zugangsdaten enthalten."); }
}
