package de.forgeflow.workspace;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.*;
import java.util.function.ToLongFunction;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.workspace.WorkspaceDtos.*;

public final class WorkspaceValidation {
    private WorkspaceValidation() {}
    private static void require(boolean condition, String message) { if (!condition) throw new ApiFailure(422, "INVALID_WORKSPACE", message); }
    private static String key(String name) { return Normalizer.normalize(name.strip(), Normalizer.Form.NFC).toLowerCase(Locale.GERMAN); }
    private static <T> void unique(List<T> entries, ToLongFunction<T> id) { require(entries.stream().mapToLong(id).distinct().count() == entries.size(), "Doppelte Kennungen."); }
    private static void timestamps(String... values) {
        for (String value : values) {
            try { java.time.Instant.parse(value); }
            catch (RuntimeException instantError) { try { LocalDate.parse(value); } catch (RuntimeException dateError) { require(false, "Ungültiger Zeitstempel."); } }
        }
    }
    public static void validate(Data next, Data previous) {
        next.tasks().forEach(value -> timestamps(value.createdAt(), value.updatedAt()));
        next.activities().forEach(value -> timestamps(value.createdAt())); next.epics().forEach(value -> timestamps(value.createdAt(), value.updatedAt()));
        next.files().forEach(value -> timestamps(value.addedAt(), value.updatedAt()));
        next.wiki().articles().forEach(value -> timestamps(value.createdAt(), value.updatedAt()));
        next.wiki().categories().forEach(value -> timestamps(value.createdAt(), value.updatedAt()));
        unique(next.projects(), Project::id); unique(next.customers(), Customer::id); unique(next.tasks(), Task::id); unique(next.activities(), Activity::id);
        unique(next.epics(), Epic::id); unique(next.sprints(), Sprint::id); unique(next.files(), FileMetadata::id); unique(next.wiki().articles(), Article::id); unique(next.wiki().categories(), Category::id);
        Set<Long> projectIds = new HashSet<>(); next.projects().forEach(project -> projectIds.add(project.id()));
        for (Project project : next.projects()) {
            require(next.customers().stream().anyMatch(customer -> customer.id() == project.customerId()), "Ein Kunde fehlt.");
            try { LocalDate.parse(project.deadline()); } catch (RuntimeException error) { require(false, "Ungültige Deadline."); }
        }
        for (Task task : next.tasks()) { require(projectIds.contains(task.projectId()), "Das Aufgabenprojekt fehlt.");
            require(task.epicId() == null || next.epics().stream().anyMatch(epic -> epic.id() == task.epicId() && epic.projectId() == task.projectId()), "Ungültige Epic-Zuordnung."); }
        next.epics().forEach(epic -> require(projectIds.contains(epic.projectId()), "Das Epic-Projekt fehlt."));
        next.activities().forEach(activity -> require(projectIds.contains(activity.projectId()), "Das Aktivitätsprojekt fehlt."));
        Set<String> names = new HashSet<>();
        for (FileMetadata file : next.files()) {
            require(projectIds.contains(file.projectId()), "Das Dateiprojekt fehlt.");
            require(!file.name().equals(".") && !file.name().equals("..") && file.name().codePoints().noneMatch(code -> code < 32 || code == 127 || code == '/' || code == '\\'), "Ungültiger Dateiname.");
            require(names.add(file.projectId() + ":" + key(file.name())), "Ein Dateiname ist doppelt vorhanden.");
        }
        require(next.files().stream().mapToLong(FileMetadata::size).sum() <= 20971520, "Der Referenzspeicher erlaubt höchstens 20 MiB Dateien pro Benutzer.");
        names.clear(); next.wiki().categories().forEach(category -> require(names.add(key(category.name())), "Ein Kategoriename ist doppelt vorhanden."));
        next.wiki().articles().forEach(article -> require(article.categoryId() == null || next.wiki().categories().stream().anyMatch(category -> category.id() == article.categoryId()), "Die Wiki-Kategorie fehlt."));
        Set<Long> active = new HashSet<>(); Set<Long> plannedTasks = new HashSet<>();
        for (Sprint sprint : next.sprints()) {
            timestamps(sprint.createdAt(), sprint.updatedAt());
            if (sprint.startedAt() != null) timestamps(sprint.startedAt());
            if (sprint.completion() != null) timestamps(sprint.completion().completedAt());
            require(projectIds.contains(sprint.projectId()), "Das Sprint-Projekt fehlt.");
            try { require(!LocalDate.parse(sprint.endDate()).isBefore(LocalDate.parse(sprint.startDate())), "Ungültiger Sprint-Zeitraum."); }
            catch (RuntimeException error) { if (error instanceof ApiFailure failure) throw failure; require(false, "Ungültiges Sprint-Datum."); }
            require(new HashSet<>(sprint.taskIds()).size() == sprint.taskIds().size(), "Eine Sprint-Aufgabe ist doppelt vorhanden.");
            require(sprint.status().equals("completed") == (sprint.completion() != null), "Ungültiger Sprint-Abschluss.");
            if (sprint.status().equals("active")) require(active.add(sprint.projectId()), "Pro Projekt darf nur ein Sprint aktiv sein.");
            for (Long taskId : sprint.taskIds()) {
                require(next.tasks().stream().noneMatch(task -> task.id() == taskId && task.projectId() != sprint.projectId()), "Die Aufgabe gehört zu einem anderen Projekt.");
                if (!sprint.status().equals("completed")) require(plannedTasks.add(taskId), "Eine Aufgabe gehört zu mehreren offenen Sprints.");
            }
        }
        for (Sprint old : previous.sprints()) {
            if (!projectIds.contains(old.projectId())) continue;
            Sprint current = next.sprints().stream().filter(sprint -> sprint.id() == old.id()).findFirst().orElse(null);
            if (old.status().equals("completed") && current != null) require(old.equals(current), "Abgeschlossene Sprints sind schreibgeschützt.");
            if (old.status().equals("active")) require(current != null && !current.status().equals("planned"), "Aktive Sprints müssen zuerst abgeschlossen werden.");
        }
    }
}
