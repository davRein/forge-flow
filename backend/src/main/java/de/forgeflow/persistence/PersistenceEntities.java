package de.forgeflow.persistence;

import java.io.Serializable;
import java.util.Objects;
import jakarta.persistence.*;

// Persistence types stay separate from HTTP DTOs so the frontend contract remains stable.
public final class PersistenceEntities {
    private PersistenceEntities() {}

    public static class OwnedId implements Serializable {
        public String ownerId;
        public long id;
        public OwnedId() {}
        public OwnedId(String ownerId, long id) { this.ownerId = ownerId; this.id = id; }
        @Override public boolean equals(Object other) {
            return other instanceof OwnedId key && id == key.id && Objects.equals(ownerId, key.ownerId);
        }
        @Override public int hashCode() { return Objects.hash(ownerId, id); }
    }

    @MappedSuperclass
    @IdClass(OwnedId.class)
    public abstract static class OwnedRow {
        @Id @Column(name = "owner_id", length = 128, nullable = false)
        public String ownerId;
        @Id public long id;
        @Column(name = "sort_order", nullable = false)
        public int position;
    }

    @Entity(name = "StoredAccount")
    @Table(name = "ff_accounts")
    public static class AccountRow {
        @Id @Column(length = 128) public String id;
        @Column(nullable = false, unique = true, length = 254) public String email;
        @Column(nullable = false, columnDefinition = "text") public String name;
        @Column(name = "password_hash", nullable = false, length = 60) public String passwordHash;
        @Column(nullable = false) public boolean administrator;
        @Column(nullable = false) public boolean active = true;
        @Column(name = "session_version", nullable = false) public long sessionVersion;
    }

    @Entity(name = "StoredAccountSetup")
    @Table(name = "ff_account_setup")
    public static class AccountSetupRow {
        @Id public int id;
        @Column(name = "administrator_assigned", nullable = false) public boolean administratorAssigned;
    }

    @Entity(name = "StoredRestCollections")
    @Table(name = "ff_rest_collections")
    public static class RestCollectionsRow {
        @Id @Column(name = "owner_id", length = 128) public String ownerId;
        @Column(nullable = false, length = 128) public String revision;
        @Column(nullable = false, columnDefinition = "text") public String payload;
    }

    @Entity(name = "StoredWorkspace")
    @Table(name = "ff_workspaces")
    public static class WorkspaceRow {
        @Id @Column(name = "owner_id", length = 128) public String ownerId;
        @Column(nullable = false, length = 128) public String revision;
    }

    @Entity(name = "StoredGlobalSettings")
    @Table(name = "ff_global_settings")
    public static class GlobalSettingsRow {
        @Id public int id;
        @Column(nullable = false, length = 128) public String revision;
        @Column(nullable = false, columnDefinition = "text") public String industries;
    }

    @Entity(name = "StoredSettings")
    @Table(name = "ff_settings")
    public static class SettingsRow {
        @Id @Column(name = "owner_id", length = 128) public String ownerId;
        @Column(name = "theme_mode", nullable = false, length = 10) public String themeMode;
        @Column(name = "default_project_view", nullable = false, length = 20) public String defaultProjectView;
        @Column(name = "default_task_priority", nullable = false, length = 10) public String defaultTaskPriority;
        @Column(nullable = false, length = 2) public String language;
    }

    @Entity(name = "StoredCustomer")
    @Table(name = "ff_customers")
    public static class CustomerRow extends OwnedRow {
        @Column(name = "notes", nullable = false, columnDefinition = "text") public String notes;
        @Column(name = "postal_code", nullable = false, length = 32) public String postalCode;
        @Column(name = "name", nullable = false, columnDefinition = "text") public String name;
        @Column(name = "street", nullable = false, columnDefinition = "text") public String street;
        @Column(name = "city", nullable = false, columnDefinition = "text") public String city;
        @Column(name = "country", nullable = false, columnDefinition = "text") public String country;
        @Column(name = "email", nullable = false, columnDefinition = "text") public String email;
        @Column(name = "website", nullable = true, columnDefinition = "text") public String website;
        @Column(name = "phone", nullable = false, columnDefinition = "text") public String phone;
        @Column(name = "industry", nullable = false, columnDefinition = "text") public String industry;
    }

    @Entity(name = "StoredCustomerContact")
    @Table(name = "ff_customer_contacts")
    public static class CustomerContactRow extends OwnedRow {
        @Column(name = "customer_id", nullable = false) public long customerId;
        @Column(nullable = false, columnDefinition = "text") public String name;
        @Column(nullable = false, length = 200) public String role;
        @Column(nullable = false, length = 254) public String email;
        @Column(nullable = false, length = 100) public String phone;
    }

    @Entity(name = "StoredProject")
    @Table(name = "ff_projects")
    public static class ProjectRow extends OwnedRow {
        @Column(name = "customer_id", nullable = false) public long customerId;
        @Column(name = "name", nullable = false, columnDefinition = "text") public String name;
        @Column(name = "planning_completed", nullable = false) public boolean planningCompleted;
        @Column(name = "deadline", nullable = false, columnDefinition = "text") public String deadline;
    }

    @Entity(name = "StoredEpic")
    @Table(name = "ff_epics")
    public static class EpicRow extends OwnedRow {
        @Column(name = "project_id", nullable = false) public long projectId;
        @Column(name = "title", nullable = false, columnDefinition = "text") public String title;
        @Column(name = "description", nullable = false, columnDefinition = "text") public String description;
        @Column(name = "created_at", nullable = false, columnDefinition = "text") public String createdAt;
        @Column(name = "updated_at", nullable = false, columnDefinition = "text") public String updatedAt;
    }

    @Entity(name = "StoredTask")
    @Table(name = "ff_tasks")
    public static class TaskRow extends OwnedRow {
        @Column(name = "project_id", nullable = false) public long projectId;
        @Column(name = "epic_id", nullable = true) public Long epicId;
        @Column(name = "code", nullable = false, columnDefinition = "text") public String code;
        @Column(name = "title", nullable = false, columnDefinition = "text") public String title;
        @Column(name = "description", nullable = true, columnDefinition = "text") public String description;
        @Column(name = "status", nullable = false, columnDefinition = "text") public String status;
        @Column(name = "priority", nullable = false, columnDefinition = "text") public String priority;
        @Column(name = "created_at", nullable = false, columnDefinition = "text") public String createdAt;
        @Column(name = "updated_at", nullable = false, columnDefinition = "text") public String updatedAt;
    }

    @Entity(name = "StoredActivity")
    @Table(name = "ff_activities")
    public static class ActivityRow extends OwnedRow {
        @Column(name = "project_id", nullable = false) public long projectId;
        @Column(name = "type", nullable = false, columnDefinition = "text") public String type;
        @Column(name = "message", nullable = false, columnDefinition = "text") public String message;
        @Column(name = "created_at", nullable = false, columnDefinition = "text") public String createdAt;
    }

    @Entity(name = "StoredSprint")
    @Table(name = "ff_sprints")
    public static class SprintRow extends OwnedRow {
        @Column(name = "project_id", nullable = false) public long projectId;
        @Column(name = "title", nullable = false, columnDefinition = "text") public String title;
        @Column(name = "goal", nullable = false, columnDefinition = "text") public String goal;
        @Column(name = "start_date", nullable = false, columnDefinition = "text") public String startDate;
        @Column(name = "end_date", nullable = false, columnDefinition = "text") public String endDate;
        @Column(name = "status", nullable = false, columnDefinition = "text") public String status;
        @Column(name = "task_ids", nullable = false, columnDefinition = "text") public String taskIds;
        @Column(name = "created_at", nullable = false, columnDefinition = "text") public String createdAt;
        @Column(name = "updated_at", nullable = false, columnDefinition = "text") public String updatedAt;
        @Column(name = "started_at", nullable = true, columnDefinition = "text") public String startedAt;
        @Column(name = "completion", nullable = true, columnDefinition = "text") public String completion;
    }

    @Entity(name = "StoredFileMetadata")
    @Table(name = "ff_files")
    public static class FileRow extends OwnedRow {
        @Column(name = "project_id", nullable = false) public long projectId;
        @Column(name = "name", nullable = false, columnDefinition = "text") public String name;
        @Column(name = "size", nullable = false) public long size;
        @Column(name = "media_type", nullable = false, columnDefinition = "text") public String mediaType;
        @Column(name = "last_modified", nullable = false) public long lastModified;
        @Column(name = "added_at", nullable = false, columnDefinition = "text") public String addedAt;
        @Column(name = "updated_at", nullable = false, columnDefinition = "text") public String updatedAt;
        @Column(name = "content", nullable = false, columnDefinition = "bytea") public byte[] content;
    }

    @Entity(name = "StoredCategory")
    @Table(name = "ff_wiki_categories")
    public static class CategoryRow extends OwnedRow {
        @Column(name = "name", nullable = false, columnDefinition = "text") public String name;
        @Column(name = "description", nullable = false, columnDefinition = "text") public String description;
        @Column(name = "created_at", nullable = false, columnDefinition = "text") public String createdAt;
        @Column(name = "updated_at", nullable = false, columnDefinition = "text") public String updatedAt;
    }

    @Entity(name = "StoredArticle")
    @Table(name = "ff_wiki_articles")
    public static class ArticleRow extends OwnedRow {
        @Column(name = "parent_id", nullable = true) public Long parentId;
        @Column(name = "title", nullable = false, columnDefinition = "text") public String title;
        @Column(name = "content", nullable = false, columnDefinition = "text") public String content;
        @Column(name = "category_id", nullable = true) public Long categoryId;
        @Column(name = "created_at", nullable = false, columnDefinition = "text") public String createdAt;
        @Column(name = "updated_at", nullable = false, columnDefinition = "text") public String updatedAt;
    }
}
