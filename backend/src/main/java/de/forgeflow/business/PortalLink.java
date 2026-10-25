package de.forgeflow.business;

import java.util.*;
import jakarta.validation.constraints.*;
public record PortalLink(@NotBlank @Size(max=128) String userId, @NotBlank @Size(max=128) String ownerId,
        @NotBlank @Size(max=128) String revision, @Positive long customerId, boolean active,
        @NotNull @Size(max=1000) List<@NotNull @Positive Long> projectIds, @NotNull @Size(max=1000) List<@NotNull @Positive Long> articleIds,
        @NotNull @Size(max=1000) List<@NotNull @Positive Long> fileIds, @NotNull @Size(max=1000) List<@NotNull UUID> documentIds,
        @NotNull @Size(max=120) List<@NotNull @Pattern(regexp="\\d{4}-\\d{2}") String> reportMonths,
        @Size(max=5242880) String snapshot) {
    public PortalLink(String userId, String ownerId, String revision, long customerId, boolean active, List<Long> projects, List<Long> articles, List<Long> files, List<UUID> documents, List<String> months) { this(userId, ownerId, revision, customerId, active, projects, articles, files, documents, months, ""); }
    public PortalLink withRevision(String value) { return new PortalLink(userId, ownerId, value, customerId, active, projectIds, articleIds, fileIds, documentIds, reportMonths, snapshot); }
    public PortalLink withSnapshot(String value) { return new PortalLink(userId, ownerId, revision, customerId, active, projectIds, articleIds, fileIds, documentIds, reportMonths, value); }
}
