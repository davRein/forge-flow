package de.forgeflow.business;

import java.util.*;
import de.forgeflow.time.TimeTracking;
public record PortalSnapshot(String customerName, List<Project> projects, List<Page> articles, List<File> files,
        List<BusinessData.Document> documents, Map<String, List<TimeTracking.Entry>> reports) {
    public record Project(long id, String name, String deadline, long tasks, long done) {}
    public record Page(long id, String title, String content) {}
    public record File(long id, long projectId, String name, long size, String sha256) {}
    public static PortalSnapshot empty() { return new PortalSnapshot("", List.of(), List.of(), List.of(), List.of(), Map.of()); }
}
