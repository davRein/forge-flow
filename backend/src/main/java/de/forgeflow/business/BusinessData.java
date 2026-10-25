package de.forgeflow.business;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record BusinessData(@Min(1) @Max(1) int version, @NotBlank @Size(max=128) String revision,
        @NotNull @Valid Profile profile, @NotNull @Size(max=10000) List<@NotNull @Valid Budget> budgets,
        @NotNull @Size(max=500) List<@NotNull @Valid Template> templates,
        @NotNull @Size(max=1000) List<@NotNull @Valid Document> documents, @Valid Timer timer) {
    public record Profile(@NotNull @Size(max=1000) String company, @NotNull @Size(max=3000) String address,
        @NotNull @Size(max=254) String email, @NotNull @Size(max=200) String taxId, @NotNull @Size(max=1000) String bank,
        @NotNull @Pattern(regexp="EUR|USD|CHF|GBP") String currency, @Min(0) @Max(10000) int taxBasisPoints,
        @Min(0) @Max(100000000) long hourlyRateCents, @Min(0) @Max(365) int paymentDays) {}
    public record Budget(@Positive long projectId, @Min(1) @Max(10000000) int minutes, @Min(0) @Max(100000000) long hourlyRateCents) {}
    public record Template(@NotNull UUID id, @NotBlank @Size(max=200) String name, @NotNull @Size(max=2000) String description,
        @NotNull @Size(max=100) List<@NotNull @Valid TemplateTask> tasks,
        @NotNull @Size(max=30) List<@NotBlank @Size(max=1000) String> milestones,
        @NotNull @Size(max=30) List<@NotNull @Valid TemplatePage> pages) {}
    public record TemplateTask(@NotBlank @Size(max=1000) String title, @NotNull @Size(max=10000) String description,
        @NotNull @Pattern(regexp="low|medium|high") String priority) {}
    public record TemplatePage(@NotBlank @Size(max=1000) String title, @NotNull @Size(max=100000) String content) {}
    public record Line(@NotBlank @Size(max=1000) String description,
        @NotNull @Pattern(regexp="(?:0|[1-9][0-9]{0,6})(?:\\.[0-9]{1,3})?") String quantity,
        @Min(0) @Max(100000000) long unitPriceCents, @Min(0) @Max(10000) int taxBasisPoints,
        @Min(0) @Max(10000000) int minutes) {}
    public record Document(@NotNull UUID id, @NotNull @Pattern(regexp="offer|invoice") String kind, @Positive long customerId,
        @Positive Long projectId, @NotBlank @Size(max=300) String title, @NotBlank String date, @NotBlank String dueDate,
        @NotNull @Pattern(regexp="draft|issued|accepted|rejected|paid|cancelled") String status,
        @NotNull @Size(max=100) String number, @NotNull @Size(max=6000) String issuer, @NotNull @Size(max=6000) String recipient,
        @NotNull @Pattern(regexp="EUR|USD|CHF|GBP") String currency, @NotNull @Size(max=100) List<@NotNull @Valid Line> lines,
        @NotNull @Size(max=10000) List<@NotNull UUID> timeEntryIds, @NotNull @Size(max=10000) String notes) {
        public Document with(String nextStatus, String nextNumber, String nextIssuer, String nextRecipient) {
            return new Document(id, kind, customerId, projectId, title, date, dueDate, nextStatus, nextNumber, nextIssuer, nextRecipient, currency, lines, timeEntryIds, notes);
        }
        @Override public String toString() { return "BusinessDocument[content=REDACTED]"; }
    }
    public record Timer(UUID id, String startedAt, long elapsedSeconds, String originAt, String zone,
        Long customerId, Long projectId, String comment, boolean billable) {}
    public static BusinessData empty() { return new BusinessData(1, "business-initial", new Profile("", "", "", "", "", "EUR", 0, 0, 14), List.of(), List.of(), List.of(), null); }
    public BusinessData withRevision(String value) { return new BusinessData(1, value, profile, budgets, templates, documents, timer); }
    public BusinessData withTimer(Timer value) { return new BusinessData(1, revision, profile, budgets, templates, documents, value); }
    @Override public String toString() { return "BusinessData[content=REDACTED]"; }
}
