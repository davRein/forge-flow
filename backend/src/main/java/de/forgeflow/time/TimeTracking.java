package de.forgeflow.time;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.validation.constraints.*;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.workspace.WorkspaceDtos;

/** Private wall-clock bookings; minutes are net work, breaks reserve additional time. */
public record TimeTracking(@Min(1) @Max(1) int version, @NotBlank @Size(max=128) String revision,
        @NotNull @Size(max=10000) List<@NotNull @Valid Entry> entries) {
    public TimeTracking { if (entries != null) entries = List.copyOf(entries); }
    public record Entry(@NotNull UUID id, @NotNull @Pattern(regexp="\\d{4}-\\d{2}-\\d{2}") String date,
            @NotNull @Min(0) @Max(1439) Integer startMinute, @NotNull @Min(1) @Max(1440) Integer minutes,
            @NotNull @Min(0) @Max(1439) Integer breakMinutes, @Positive Long customerId, @Positive Long projectId,
            @NotNull @Size(max=1000) String customerName, @NotNull @Size(max=1000) String projectName,
            @NotNull @Size(max=2000) String comment, @NotNull Boolean billable) {
        public Entry names(String customer, String project) { return new Entry(id, date, startMinute, minutes, breakMinutes, customerId, projectId, customer, project, comment, billable); }
        @Override public String toString() { return "TimeEntry[content=REDACTED]"; }
    }
    @Override public String toString() { return "TimeTracking[content=REDACTED]"; }
    public static TimeTracking empty() { return new TimeTracking(1, "time-initial", List.of()); }
    public TimeTracking withRevision(String value) { return new TimeTracking(1, value, entries); }
    public TimeTracking normalized(TimeTracking previous, WorkspaceDtos.Data workspace, Validator validator, JsonMapper json) {
        if (!validator.validate(this).isEmpty()) throw invalid("Bitte gültige Zeiteinträge angeben.");
        var old = new HashMap<UUID, Entry>(); previous.entries.forEach(entry -> old.put(entry.id, entry));
        var customers = new HashMap<Long, WorkspaceDtos.Customer>(); workspace.customers().forEach(value -> customers.put(value.id(), value));
        var projects = new HashMap<Long, WorkspaceDtos.Project>(); workspace.projects().forEach(value -> projects.put(value.id(), value));
        var ids = new HashSet<UUID>(); var result = new ArrayList<Entry>();
        for (var entry : entries) {
            if (!ids.add(entry.id)) throw invalid("Zeiteinträge müssen eindeutige Kennungen haben.");
            try { if (LocalDate.parse(entry.date).getYear() < 1) throw invalid("Bitte ein gültiges Datum angeben."); }
            catch (DateTimeParseException exception) { throw invalid("Bitte ein gültiges Datum angeben."); }
            if (entry.startMinute + entry.minutes + entry.breakMinutes > 1440) throw invalid("Ein Zeiteintrag darf nicht über Mitternacht reichen.");
            String customerName = "", projectName = ""; var prior = old.get(entry.id);
            if (entry.customerId == null) {
                if (entry.projectId != null) throw invalid("Bitte zuerst den Kunden des Projekts auswählen.");
            } else {
                var customer = customers.get(entry.customerId);
                if (prior != null && Objects.equals(prior.customerId, entry.customerId)) customerName = prior.customerName;
                else if (customer != null) customerName = customer.name();
                else throw invalid("Der ausgewählte Kunde ist nicht verfügbar.");
                if (entry.projectId != null) {
                    var project = projects.get(entry.projectId);
                    if (prior != null && Objects.equals(prior.customerId, entry.customerId) && Objects.equals(prior.projectId, entry.projectId)) projectName = prior.projectName;
                    else if (project != null && Objects.equals(project.customerId(), entry.customerId)) projectName = project.name();
                    else throw invalid("Das ausgewählte Projekt gehört nicht zu diesem Kunden.");
                }
            }
            result.add(entry.names(customerName, projectName));
        }
        var sorted = result.stream().sorted(Comparator.comparing(Entry::date).thenComparingInt(Entry::startMinute)).toList();
        Entry last = null;
        for (var entry : sorted) {
            if (last != null && last.date.equals(entry.date) && last.startMinute + last.minutes + last.breakMinutes > entry.startMinute)
                throw invalid("Zeiteinträge dürfen sich einschließlich Pausen nicht überschneiden.");
            last = entry;
        }
        var value = new TimeTracking(1, revision, result);
        if (json.writeValueAsString(value).getBytes(StandardCharsets.UTF_8).length > 5 * 1024 * 1024)
            throw new ApiFailure(413, "TIME_TRACKING_LIMIT", "Zeiteinträge dürfen insgesamt höchstens 5 MiB umfassen.");
        return value;
    }
    private static ApiFailure invalid(String message) { return new ApiFailure(422, "INVALID_TIME_ENTRY", message); }
}
