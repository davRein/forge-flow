package de.forgeflow.persistence;

import java.util.Arrays;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.workspace.WorkspaceDtos.*;
import de.forgeflow.persistence.PersistenceEntities.*;

// Explicit conversion preserves the HTTP field values and original collection order.
final class WorkspaceRows {
    private final JsonMapper json;
    WorkspaceRows(JsonMapper json) { this.json = json; }

    CustomerRow fromCustomer(String owner, int position, Customer value) {
        var row = new CustomerRow();
        row.ownerId = owner;
        row.id = value.id();
        row.position = position;
        row.name = value.name();
        row.street = value.street();
        row.postalCode = value.postalCode();
        row.city = value.city();
        row.country = value.country();
        row.email = value.email();
        row.website = value.website();
        row.phone = value.phone();
        row.industry = value.industry();
        row.notes = value.notes();
        return row;
    }

    Customer toCustomer(CustomerRow row, java.util.List<CustomerContact> contacts) {
        return new Customer(row.id, row.name, row.street, row.city, row.country, row.email, row.website, row.phone, row.industry, row.postalCode, contacts, row.notes);
    }

    CustomerContactRow fromContact(String owner, int position, CustomerContact value) {
        var row = new CustomerContactRow(); row.ownerId = owner; row.id = value.id(); row.position = position;
        row.customerId = value.customerId(); row.name = value.name(); row.role = value.role(); row.email = value.email(); row.phone = value.phone(); return row;
    }
    CustomerContact toContact(CustomerContactRow row) {
        return new CustomerContact(row.id, row.customerId, row.name, row.role, row.email, row.phone);
    }

    ProjectRow fromProject(String owner, int position, Project value) {
        var row = new ProjectRow();
        row.ownerId = owner;
        row.id = value.id();
        row.position = position;
        row.customerId = value.customerId();
        row.name = value.name();
        row.planningCompleted = value.planningCompleted();
        row.deadline = value.deadline();
        return row;
    }

    Project toProject(ProjectRow row) {
        return new Project(row.id, row.customerId, row.name, row.planningCompleted, row.deadline);
    }

    EpicRow fromEpic(String owner, int position, Epic value) {
        var row = new EpicRow();
        row.ownerId = owner;
        row.id = value.id();
        row.position = position;
        row.projectId = value.projectId();
        row.title = value.title();
        row.description = value.description();
        row.createdAt = value.createdAt();
        row.updatedAt = value.updatedAt();
        return row;
    }

    Epic toEpic(EpicRow row) {
        return new Epic(row.id, row.projectId, row.title, row.description, row.createdAt, row.updatedAt);
    }

    TaskRow fromTask(String owner, int position, Task value) {
        var row = new TaskRow();
        row.ownerId = owner;
        row.id = value.id();
        row.position = position;
        row.projectId = value.projectId();
        row.epicId = value.epicId();
        row.code = value.code();
        row.title = value.title();
        row.description = value.description();
        row.status = value.status();
        row.priority = value.priority();
        row.createdAt = value.createdAt();
        row.updatedAt = value.updatedAt();
        return row;
    }

    Task toTask(TaskRow row) {
        return new Task(row.id, row.projectId, row.epicId, row.code, row.title, row.description, row.status, row.priority, row.createdAt, row.updatedAt);
    }

    ActivityRow fromActivity(String owner, int position, Activity value) {
        var row = new ActivityRow();
        row.ownerId = owner;
        row.id = value.id();
        row.position = position;
        row.projectId = value.projectId();
        row.type = value.type();
        row.message = value.message();
        row.createdAt = value.createdAt();
        return row;
    }

    Activity toActivity(ActivityRow row) {
        return new Activity(row.id, row.projectId, row.type, row.message, row.createdAt);
    }

    SprintRow fromSprint(String owner, int position, Sprint value) {
        var row = new SprintRow();
        row.ownerId = owner;
        row.id = value.id();
        row.position = position;
        row.projectId = value.projectId();
        row.title = value.title();
        row.goal = value.goal();
        row.startDate = value.startDate();
        row.endDate = value.endDate();
        row.status = value.status();
        row.taskIds = json.writeValueAsString(value.taskIds());
        row.createdAt = value.createdAt();
        row.updatedAt = value.updatedAt();
        row.startedAt = value.startedAt();
        row.completion = value.completion() == null ? null : json.writeValueAsString(value.completion());
        return row;
    }

    Sprint toSprint(SprintRow row) {
        return new Sprint(row.id, row.projectId, row.title, row.goal, row.startDate, row.endDate, row.status, Arrays.asList(json.readValue(row.taskIds, Long[].class)), row.createdAt, row.updatedAt, row.startedAt, row.completion == null ? null : json.readValue(row.completion, Completion.class));
    }

    FileRow fromFileMetadata(String owner, int position, FileMetadata value, byte[] content) {
        var row = new FileRow();
        row.ownerId = owner;
        row.id = value.id();
        row.position = position;
        row.projectId = value.projectId();
        row.name = value.name();
        row.size = value.size();
        row.mediaType = value.mediaType();
        row.lastModified = value.lastModified();
        row.addedAt = value.addedAt();
        row.updatedAt = value.updatedAt();
        row.content = content;
        return row;
    }

    FileMetadata toFileMetadata(FileRow row) {
        return new FileMetadata(row.id, row.projectId, row.name, row.size, row.mediaType, row.lastModified, row.addedAt, row.updatedAt);
    }

    CategoryRow fromCategory(String owner, int position, Category value) {
        var row = new CategoryRow();
        row.ownerId = owner;
        row.id = value.id();
        row.position = position;
        row.name = value.name();
        row.description = value.description();
        row.createdAt = value.createdAt();
        row.updatedAt = value.updatedAt();
        return row;
    }

    Category toCategory(CategoryRow row) {
        return new Category(row.id, row.name, row.description, row.createdAt, row.updatedAt);
    }

    ArticleRow fromArticle(String owner, int position, Article value) {
        var row = new ArticleRow();
        row.ownerId = owner;
        row.id = value.id();
        row.position = position;
        row.title = value.title();
        row.content = value.content();
        row.categoryId = value.categoryId();
        row.parentId = value.parentId();
        row.createdAt = value.createdAt();
        row.updatedAt = value.updatedAt();
        return row;
    }

    Article toArticle(ArticleRow row) {
        return new Article(row.id, row.title, row.content, row.categoryId, row.createdAt, row.updatedAt, row.parentId);
    }
}
