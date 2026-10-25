package de.forgeflow.persistence;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Function;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.validation.Validator;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.persistence.PersistenceEntities.*;
import de.forgeflow.workspace.WorkspaceDtos.*;
import de.forgeflow.workspace.WorkspaceStorage;
import de.forgeflow.workspace.WorkspaceValidation;
import de.forgeflow.workspace.RecentActivity;

@Repository
@Profile("postgres")
public class JpaWorkspaceStorage implements WorkspaceStorage {
    @Override public String kind() { return "postgresql"; }
    private final EntityManager entityManager;
    private final Validator validator;
    private final WorkspaceRows rows;
    private final JsonMapper json;
    @Override @Transactional(readOnly = true)
    public List<RecentActivity.Entry> loadRecentActivity(String ownerId) {
        var row = entityManager.find(RecentActivityRow.class, ownerId);
        return row == null ? List.of() : List.of(json.readValue(row.payload, RecentActivity.Entry[].class));
    }
    private void saveRecentActivity(String ownerId, List<RecentActivity.Entry> entries) {
        var row = entityManager.find(RecentActivityRow.class, ownerId); boolean created = row == null;
        if (created) { row = new RecentActivityRow(); row.ownerId = ownerId; }
        row.payload = json.writeValueAsString(entries);
        if (created) entityManager.persist(row);
    }
    @Override @Transactional(readOnly = true)
    public de.forgeflow.workspace.GlobalSettings loadGlobalSettings() {
        var row = entityManager.find(GlobalSettingsRow.class, 1);
        return new de.forgeflow.workspace.GlobalSettings(row.revision, java.util.Arrays.asList(json.readValue(row.industries, String[].class)));
    }
    @Override @Transactional
    public de.forgeflow.workspace.GlobalSettings saveGlobalSettings(de.forgeflow.workspace.GlobalSettings input) {
        var values = input.normalized(); var row = entityManager.find(GlobalSettingsRow.class, 1, LockModeType.PESSIMISTIC_WRITE);
        if (!row.revision.equals(values.revision())) throw new ApiFailure(409, "VERSION_CONFLICT", "Die Branchenliste wurde inzwischen geändert. Bitte neu laden.");
        row.industries = json.writeValueAsString(values.industries()); row.revision = UUID.randomUUID().toString();
        return new de.forgeflow.workspace.GlobalSettings(row.revision, values.industries());
    }

    public JpaWorkspaceStorage(EntityManager entityManager, Validator validator, JsonMapper json) {
        this.entityManager = entityManager;
        this.validator = validator;
        this.rows = new WorkspaceRows(json);
        this.json = json;
    }

    private void lockAccount(String ownerId) {
        // The account exists before its workspace. Locking it also serializes the first save.
        if (entityManager.find(AccountRow.class, ownerId, LockModeType.PESSIMISTIC_WRITE) == null)
            throw new ApiFailure(401, "UNAUTHENTICATED", "Bitte anmelden.");
    }

    private WorkspaceRow workspace(String ownerId) {
        var row = entityManager.find(WorkspaceRow.class, ownerId);
        if (row == null) {
            row = new WorkspaceRow();
            row.ownerId = ownerId;
            row.revision = UUID.randomUUID().toString();
            entityManager.persist(row);
            entityManager.flush();
        }
        return row;
    }

    private <T extends OwnedRow> List<T> list(String entityName, Class<T> type, String ownerId) {
        return entityManager.createQuery("select row from " + entityName + " row where row.ownerId = :owner order by row.position", type)
            .setParameter("owner", ownerId).getResultList();
    }

    private <T extends OwnedRow, D> List<D> values(String entityName, Class<T> type, String ownerId, Function<T, D> convert) {
        return list(entityName, type, ownerId).stream().map(convert).toList();
    }

    private Data data(String ownerId) {
        var contacts = values("StoredCustomerContact", CustomerContactRow.class, ownerId, rows::toContact).stream()
            .collect(java.util.stream.Collectors.groupingBy(CustomerContact::customerId));
        return new Data(
            values("StoredProject", ProjectRow.class, ownerId, rows::toProject),
            values("StoredCustomer", CustomerRow.class, ownerId, row -> rows.toCustomer(row, contacts.getOrDefault(row.id, List.of()))),
            values("StoredTask", TaskRow.class, ownerId, rows::toTask),
            values("StoredActivity", ActivityRow.class, ownerId, rows::toActivity),
            values("StoredEpic", EpicRow.class, ownerId, rows::toEpic),
            values("StoredSprint", SprintRow.class, ownerId, rows::toSprint),
            values("StoredFileMetadata", FileRow.class, ownerId, rows::toFileMetadata),
            new Wiki(values("StoredArticle", ArticleRow.class, ownerId, rows::toArticle),
                values("StoredCategory", CategoryRow.class, ownerId, rows::toCategory)));
    }

    @Override
    @Transactional
    public Envelope load(String ownerId) {
        lockAccount(ownerId);
        return new Envelope(1, workspace(ownerId).revision, data(ownerId));
    }

    private <T, R extends OwnedRow> void insert(List<T> values, BiFunction<Integer, T, R> convert) {
        for (int index = 0; index < values.size(); index++) entityManager.persist(convert.apply(index, values.get(index)));
        // Parents must be written before their children so immediate foreign keys also work.
        entityManager.flush();
    }

    @Override
    @Transactional
    public String save(String ownerId, String expectedRevision, Data next, Map<Long, Attachment> incoming) {
        lockAccount(ownerId);
        if (!workspace(ownerId).revision.equals(expectedRevision))
            throw new ApiFailure(409, "VERSION_CONFLICT", "Die Daten wurden inzwischen geändert. Bitte neu laden.");
        var previous = data(ownerId);
        next = WorkspaceValidation.preserveCustomerDetails(next, previous);
        if (next == null || !validator.validate(next).isEmpty())
            throw new ApiFailure(422, "INVALID_WORKSPACE", "Ungültige Workspace-Daten.");
        WorkspaceValidation.validate(next, previous);

        Map<Long, byte[]> content = new HashMap<>();
        list("StoredFileMetadata", FileRow.class, ownerId).forEach(file -> content.put(file.id, file.content));
        for (FileMetadata file : next.files()) {
            if (incoming.containsKey(file.id())) content.put(file.id(), incoming.get(file.id()).bytes());
            if (!content.containsKey(file.id()) || content.get(file.id()).length != file.size())
                throw new ApiFailure(422, "INVALID_WORKSPACE", "Eine Datei fehlt oder hat die falsche Größe.");
        }
        // Delete/reinsert is one database transaction, including attachments and the revision.
        // Detach the old self-references first; H2 checks them row by row during a bulk delete.
        entityManager.createQuery("update StoredArticle row set row.parentId = null where row.ownerId = :owner").setParameter("owner", ownerId).executeUpdate();
        for (String entity : List.of("StoredCustomerContact", "StoredTask", "StoredActivity", "StoredSprint", "StoredFileMetadata",
                "StoredEpic", "StoredArticle", "StoredCategory", "StoredProject", "StoredCustomer"))
            entityManager.createQuery("delete from " + entity + " row where row.ownerId = :owner")
                .setParameter("owner", ownerId).executeUpdate();
        entityManager.clear();

        insert(next.customers(), (index, value) -> rows.fromCustomer(ownerId, index, value));
        insert(next.customers().stream().flatMap(customer -> customer.contacts().stream()).toList(), (index, value) -> rows.fromContact(ownerId, index, value));
        insert(next.projects(), (index, value) -> rows.fromProject(ownerId, index, value));
        insert(next.epics(), (index, value) -> rows.fromEpic(ownerId, index, value));
        insert(next.tasks(), (index, value) -> rows.fromTask(ownerId, index, value));
        insert(next.activities(), (index, value) -> rows.fromActivity(ownerId, index, value));
        insert(next.sprints(), (index, value) -> rows.fromSprint(ownerId, index, value));
        insert(next.files(), (index, value) -> rows.fromFileMetadata(ownerId, index, value, content.get(value.id())));
        insert(next.wiki().categories(), (index, value) -> rows.fromCategory(ownerId, index, value));
        // Flush each hierarchy level before children, retaining the original presentation order.
        var pages = next.wiki().articles();
        var positions = new HashMap<Long, Integer>();
        for (int index = 0; index < pages.size(); index++) positions.put(pages.get(index).id(), index);
        var written = new HashSet<Long>();
        while (written.size() < pages.size()) {
            var level = pages.stream().filter(page -> !written.contains(page.id()) && (page.parentId() == null || written.contains(page.parentId()))).toList();
            if (level.isEmpty()) throw new IllegalStateException("Invalid page hierarchy after validation.");
            insert(level, (index, value) -> rows.fromArticle(ownerId, positions.get(value.id()), value));
            level.forEach(page -> written.add(page.id()));
        }

        String revision = UUID.randomUUID().toString();
        workspace(ownerId).revision = revision;
        saveRecentActivity(ownerId, RecentActivity.workspace(loadRecentActivity(ownerId), previous, next));
        return revision;
    }

    @Override
    @Transactional(readOnly = true)
    public Attachment attachment(String ownerId, long projectId, long fileId) {
        var file = entityManager.find(FileRow.class, new OwnedId(ownerId, fileId));
        if (file == null || file.projectId != projectId) throw new ApiFailure(404, "NOT_FOUND", "Datei nicht gefunden.");
        return new Attachment(file.content);
    }

    @Override
    @Transactional(readOnly = true)
    public Settings loadSettings(String ownerId) {
        var row = entityManager.find(SettingsRow.class, ownerId);
        return row == null ? null : new Settings(1, new SettingsValues(row.themeMode, row.defaultProjectView, row.defaultTaskPriority, row.language));
    }

    @Override
    @Transactional
    public void saveSettings(String ownerId, Settings settings) {
        lockAccount(ownerId);
        var previous = loadSettings(ownerId);
        if (settings == null || !validator.validate(settings).isEmpty())
            throw new ApiFailure(400, "INVALID_INPUT", "Bitte die Einstellungen prüfen.");
        var row = entityManager.find(SettingsRow.class, ownerId);
        if (row == null) {
            row = new SettingsRow();
            row.ownerId = ownerId;
        }
        row.themeMode = settings.settings().themeMode();
        row.defaultProjectView = settings.settings().defaultProjectView();
        row.defaultTaskPriority = settings.settings().defaultTaskPriority();
        row.language = settings.settings().language();
        entityManager.persist(row);
        saveRecentActivity(ownerId, RecentActivity.settings(loadRecentActivity(ownerId), previous, settings));
    }
}
