package de.forgeflow.workspace;

import java.util.Map;
import de.forgeflow.workspace.WorkspaceDtos.*;

public interface WorkspaceStorage {
    default String kind() { return "reference"; }
    record Attachment(byte[] bytes) { public Attachment { bytes = bytes.clone(); } @Override public byte[] bytes() { return bytes.clone(); } }
    Envelope load(String ownerId);
    String save(String ownerId, String expectedRevision, Data data, Map<Long, Attachment> incoming);
    Attachment attachment(String ownerId, long projectId, long fileId);
    Settings loadSettings(String ownerId);
    void saveSettings(String ownerId, Settings settings);
    GlobalSettings loadGlobalSettings();
    GlobalSettings saveGlobalSettings(GlobalSettings settings);
    default java.util.List<RecentActivity.Entry> loadRecentActivity(String ownerId) { return java.util.List.of(); }
}
