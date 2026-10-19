package de.forgeflow.workspace;

import java.util.*;
import org.springframework.stereotype.Repository;
import org.springframework.context.annotation.Profile;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.workspace.WorkspaceDtos.*;

// Default reference adapter. The postgres profile selects JpaWorkspaceStorage instead.
@Repository
@Profile("!postgres")
public class MemoryWorkspaceStorage implements WorkspaceStorage {
    private final Map<String, Envelope> workspaces = new HashMap<>();
    private final Map<String, Map<Long, Attachment>> attachments = new HashMap<>();
    private final Map<String, Settings> settings = new HashMap<>();
    @Override public synchronized Envelope load(String ownerId) {
        return workspaces.computeIfAbsent(ownerId, id -> new Envelope(1, UUID.randomUUID().toString(), Data.empty()));
    }
    @Override public synchronized String save(String ownerId, String expectedRevision, Data data, Map<Long, Attachment> incoming) {
        Envelope current = load(ownerId);
        if (!current.revision().equals(expectedRevision)) throw new ApiFailure(409, "VERSION_CONFLICT", "Die Daten wurden inzwischen geändert. Bitte neu laden.");
        WorkspaceValidation.validate(data, current.data());
        Map<Long, Attachment> existing = attachments.getOrDefault(ownerId, Map.of());
        Map<Long, Attachment> next = new HashMap<>();
        for (FileMetadata file : data.files()) {
            Attachment content = incoming.getOrDefault(file.id(), existing.get(file.id()));
            if (content == null || content.bytes().length != file.size()) throw new ApiFailure(422, "INVALID_WORKSPACE", "Eine Datei fehlt oder hat die falsche Größe.");
            next.put(file.id(), content);
        }
        String revision = UUID.randomUUID().toString();
        attachments.put(ownerId, next); workspaces.put(ownerId, new Envelope(1, revision, data));
        return revision;
    }
    @Override public synchronized Attachment attachment(String ownerId, long projectId, long fileId) {
        if (load(ownerId).data().files().stream().noneMatch(file -> file.id() == fileId && file.projectId() == projectId)) throw new ApiFailure(404, "NOT_FOUND", "Datei nicht gefunden.");
        return attachments.getOrDefault(ownerId, Map.of()).get(fileId);
    }
    @Override public synchronized Settings loadSettings(String ownerId) { return settings.get(ownerId); }
    @Override public synchronized void saveSettings(String ownerId, Settings values) { settings.put(ownerId, values); }
}
