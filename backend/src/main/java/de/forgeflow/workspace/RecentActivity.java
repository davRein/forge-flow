package de.forgeflow.workspace;

import java.time.Instant;
import java.util.*;
import java.util.function.ToLongFunction;
import de.forgeflow.workspace.WorkspaceDtos.*;

/** A small navigation history, recorded within the same transaction as successful saves. */
public final class RecentActivity {
    private RecentActivity() {}
    public record Entry(UUID id, String kind, String action, Long entityId, String name, String at) {}
    private static Entry entry(String kind, String action, Long id, String name) {
        int end = Math.min(name.length(), 200);
        if (end < name.length() && Character.isHighSurrogate(name.charAt(end - 1))) end--;
        return new Entry(UUID.randomUUID(), kind, action, id, name.substring(0, end), Instant.now().toString());
    }
    private static <T> Map<Long, T> index(List<T> values, ToLongFunction<T> id) {
        var result = new HashMap<Long, T>(); values.forEach(value -> result.put(id.applyAsLong(value), value)); return result;
    }
    private static <T> void changedProjects(Set<Long> ids, List<T> before, List<T> after, ToLongFunction<T> id, ToLongFunction<T> project) {
        var old = index(before, id); var next = index(after, id);
        after.forEach(value -> { if (!value.equals(old.get(id.applyAsLong(value)))) ids.add(project.applyAsLong(value)); });
        before.forEach(value -> { if (!next.containsKey(id.applyAsLong(value))) ids.add(project.applyAsLong(value)); });
    }
    public static List<Entry> workspace(List<Entry> history, Data before, Data after) {
        var customers = index(before.customers(), Customer::id); var projects = index(before.projects(), Project::id);
        var changed = new HashSet<Long>();
        changedProjects(changed, before.tasks(), after.tasks(), Task::id, Task::projectId);
        changedProjects(changed, before.epics(), after.epics(), Epic::id, Epic::projectId);
        changedProjects(changed, before.sprints(), after.sprints(), Sprint::id, Sprint::projectId);
        changedProjects(changed, before.files(), after.files(), FileMetadata::id, FileMetadata::projectId);
        var additions = new ArrayList<Entry>();
        for (var customer : after.customers()) if (!customer.equals(customers.get(customer.id())))
            additions.add(entry("customer", customers.containsKey(customer.id()) ? "updated" : "created", customer.id(), customer.name()));
        for (var project : after.projects()) if (!project.equals(projects.get(project.id())) || changed.contains(project.id()))
            additions.add(entry("project", projects.containsKey(project.id()) ? "updated" : "created", project.id(), project.name()));
        Collections.reverse(additions);
        var customerIds = index(after.customers(), Customer::id).keySet(); var projectIds = index(after.projects(), Project::id).keySet();
        history.stream().filter(value -> value.kind().equals("settings") || value.kind().equals("customer") && customerIds.contains(value.entityId()) || value.kind().equals("project") && projectIds.contains(value.entityId())).forEach(additions::add);
        return List.copyOf(additions.subList(0, Math.min(5, additions.size())));
    }
    public static List<Entry> settings(List<Entry> history, Settings before, Settings after) {
        if (Objects.equals(before, after)) return history;
        var result = new ArrayList<Entry>(); result.add(entry("settings", "updated", null, "")); result.addAll(history);
        return List.copyOf(result.subList(0, Math.min(5, result.size())));
    }
}
