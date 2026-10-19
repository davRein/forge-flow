package de.forgeflow;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.auth.Accounts;
import de.forgeflow.workspace.MemoryWorkspaceStorage;
import de.forgeflow.workspace.WorkspaceDtos;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"forgeflow.user.email=admin@example.test", "server.servlet.session.cookie.secure=false", "logging.level.root=WARN", "logging.level.org.springframework=WARN", "debug=false"})
@AutoConfigureMockMvc
class BackendIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired Accounts accounts;
    @Autowired MemoryWorkspaceStorage storage;
    private static final String ORIGIN = "http://localhost:5173";
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        String hash = new BCryptPasswordEncoder(10).encode("Nur-im-Test-12345");
        registry.add("forgeflow.user.password-hash", () -> hash);
    }
    private MockHttpSession login() throws Exception {
        var csrfResult = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn();
        var session = (MockHttpSession) csrfResult.getRequest().getSession(false);
        String token = json.readTree(csrfResult.getResponse().getContentAsString()).get("csrfToken").stringValue();
        String oldId = session.getId();
        var result = mvc.perform(post("/api/v1/auth/login").session(session).header("Origin", ORIGIN).header("X-CSRF-TOKEN", token)
            .contentType("application/json").content("{\"email\":\"admin@example.test\",\"password\":\"Nur-im-Test-12345\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.user.id").value("initial-admin")).andReturn();
        assertThat(session.getId()).isNotEqualTo(oldId);
        assertThat(json.readTree(result.getResponse().getContentAsString()).get("csrfToken").stringValue()).isNotEqualTo(token);
        assertThat(result.getResponse().getContentAsString()).doesNotContain("passwordHash", "Nur-im-Test-12345");
        return session;
    }
    @Test void anonymousAccessIsBlockedAndCsrfIsRequired() throws Exception {
        mvc.perform(get("/api/v1/workspace")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").header("Origin", ORIGIN).contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
    }
    @Test void bcryptHandlesCorrectWrongAndUnicodePasswords() {
        var encoder = new BCryptPasswordEncoder(10);
        String hash = encoder.encode("Grüße-12345678");
        assertThat(encoder.matches("Grüße-12345678", hash)).isTrue();
        assertThat(encoder.matches("falsch", hash)).isFalse();
    }
    @Test void wrongLoginIsGenericAndRejectsForeignOrigin() throws Exception {
        mvc.perform(post("/api/v1/auth/login").with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content("{\"email\":\"missing@example.test\",\"password\":\"falsches-passwort\"}"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"));
        mvc.perform(post("/api/v1/auth/login").with(csrf()).header("Origin", "https://fremd.example").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
    }
    @Test void settingsAreAccountScopedAndLogoutInvalidatesSession() throws Exception {
        MockHttpSession session = login();
        mvc.perform(put("/api/v1/me/settings").session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content("{\"version\":1,\"settings\":{\"themeMode\":\"light\",\"defaultProjectView\":\"projects\",\"defaultTaskPriority\":\"high\"}}"))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me/settings").session(session)).andExpect(jsonPath("$.settings.themeMode").value("light"));
        assertThat(storage.loadSettings("another-user")).isNull();
        mvc.perform(post("/api/v1/auth/logout").session(session).with(csrf()).header("Origin", ORIGIN)).andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
    }
    @Test void workspaceSavesAtomicallyAndRejectsStaleRevision() throws Exception {
        MockHttpSession session = login();
        var response = mvc.perform(get("/api/v1/workspace").session(session)).andExpect(status().isOk()).andReturn().getResponse();
        String revision = json.readTree(response.getContentAsString()).get("revision").stringValue();
        String manifest = json.writeValueAsString(new WorkspaceDtos.Envelope(1, revision, WorkspaceDtos.Data.empty()));
        mvc.perform(multipart("/api/v1/workspace").param("manifest", manifest).session(session).with(csrf()).header("Origin", ORIGIN)
            .header("If-Match", "\"" + revision + "\"").with(request -> { request.setMethod("PUT"); return request; }))
            .andExpect(status().isOk());
        mvc.perform(multipart("/api/v1/workspace").param("manifest", manifest).session(session).with(csrf()).header("Origin", ORIGIN)
            .header("If-Match", "\"" + revision + "\"").with(request -> { request.setMethod("PUT"); return request; }))
            .andExpect(status().isConflict());
    }
    @Test void missingFileCannotPartiallyCommitWorkspace() {
        var data = WorkspaceDtos.Data.empty();
        var file = new WorkspaceDtos.FileMetadata(1, 1, "test.txt", 5, "text/plain", 0, "2026-10-18", "2026-10-18");
        var customer = new WorkspaceDtos.Customer(1, "Kunde", "", "", "", "", "", "", "");
        var project = new WorkspaceDtos.Project(1, 1, "Projekt", false, "2026-12-31");
        var incoming = new WorkspaceDtos.Data(java.util.List.of(project), java.util.List.of(customer), data.tasks(), data.activities(), data.epics(), data.sprints(), java.util.List.of(file), data.wiki());
        var before = storage.load("file-test");
        assertThatThrownBy(() -> storage.save("file-test", before.revision(), incoming, Map.of())).isInstanceOf(de.forgeflow.api.ApiFailure.class);
        assertThat(storage.load("file-test")).isEqualTo(before);
        storage.save("file-test", before.revision(), incoming, Map.of(1L, new de.forgeflow.workspace.WorkspaceStorage.Attachment("Hallo".getBytes(java.nio.charset.StandardCharsets.UTF_8))));
        assertThat(storage.attachment("file-test", 1, 1).bytes()).isEqualTo("Hallo".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertThatThrownBy(() -> storage.attachment("other-owner", 1, 1)).isInstanceOf(de.forgeflow.api.ApiFailure.class);
    }
    @Test void everyFeatureAndUploadedFileRoundTripsThroughTheHttpContract() throws Exception {
        MockHttpSession session = login();
        String revision = storage.load("initial-admin").revision();
        String now = "2026-10-18T12:00:00Z";
        var customer = new WorkspaceDtos.Customer(1, "Kunde", "Straße", "Berlin", "DE", "kunde@example.test", "", "123", "IT");
        var project = new WorkspaceDtos.Project(1, 1, "Projekt", false, "2026-12-31");
        var epic = new WorkspaceDtos.Epic(1, 1, "Epic", "Beschreibung", now, now);
        var task = new WorkspaceDtos.Task(1, 1, 1L, "FF-1", "Aufgabe", "Text", "todo", "high", now, now);
        var sprint = new WorkspaceDtos.Sprint(1, 1, "Sprint", "Ziel", "2026-10-18", "2026-10-31", "planned", java.util.List.of(1L), now, now, null, null);
        var activity = new WorkspaceDtos.Activity(1, 1, "task_created", "Aufgabe erstellt", now);
        byte[] bytes = "Grüße 🌍".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var file = new WorkspaceDtos.FileMetadata(1, 1, "Text.txt", bytes.length, "text/plain", 0, now, now);
        var wiki = new WorkspaceDtos.Wiki(java.util.List.of(new WorkspaceDtos.Article(1, "Artikel", "# Inhalt", 1L, now, now)), java.util.List.of(new WorkspaceDtos.Category(1, "Thema", "Text", now, now)));
        var data = new WorkspaceDtos.Data(java.util.List.of(project), java.util.List.of(customer), java.util.List.of(task), java.util.List.of(activity), java.util.List.of(epic), java.util.List.of(sprint), java.util.List.of(file), wiki);
        String manifest = json.writeValueAsString(new WorkspaceDtos.Envelope(1, revision, data));
        mvc.perform(multipart("/api/v1/workspace").file(new org.springframework.mock.web.MockMultipartFile("file-1", "Text.txt", "text/plain", bytes))
            .param("manifest", manifest).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + revision + "\"")
            .with(request -> { request.setMethod("PUT"); return request; })).andExpect(status().isOk());
        mvc.perform(get("/api/v1/workspace").session(session)).andExpect(jsonPath("$.data.tasks[0].epicId").value(1))
            .andExpect(jsonPath("$.data.sprints[0].taskIds[0]").value(1)).andExpect(jsonPath("$.data.wiki.articles[0].title").value("Artikel"));
        mvc.perform(get("/api/v1/projects/1/files/1/content").session(session)).andExpect(status().isOk()).andExpect(content().bytes(bytes));
        mvc.perform(get("/api/v1/projects/2/files/1/content").session(session)).andExpect(status().isNotFound());
    }
}
