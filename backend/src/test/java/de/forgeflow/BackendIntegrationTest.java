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
import de.forgeflow.workspace.WorkspaceStorage;
import org.springframework.test.context.ActiveProfiles;
import de.forgeflow.workspace.WorkspaceDtos;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"forgeflow.user.id=initial-admin", "forgeflow.user.email=admin@example.test", "server.servlet.session.cookie.secure=false", "logging.level.root=WARN", "logging.level.org.springframework=WARN", "debug=false"})
@AutoConfigureMockMvc
@ActiveProfiles("memory")
class BackendIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired Accounts accounts;
    @Autowired WorkspaceStorage storage;
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
        String owner = regularUser().id();
        var data = WorkspaceDtos.Data.empty();
        var file = new WorkspaceDtos.FileMetadata(1, 1, "test.txt", 5, "text/plain", 0, "2026-10-18", "2026-10-18");
        var customer = new WorkspaceDtos.Customer(1, "Kunde", "", "", "", "", "", "", "");
        var project = new WorkspaceDtos.Project(1, 1, "Projekt", false, "2026-12-31");
        var incoming = new WorkspaceDtos.Data(java.util.List.of(project), java.util.List.of(customer), data.tasks(), data.activities(), data.epics(), data.sprints(), java.util.List.of(file), data.wiki());
        var before = storage.load(owner);
        assertThatThrownBy(() -> storage.save(owner, before.revision(), incoming, Map.of())).isInstanceOf(de.forgeflow.api.ApiFailure.class);
        assertThat(storage.load(owner)).isEqualTo(before);
        storage.save(owner, before.revision(), incoming, Map.of(1L, new de.forgeflow.workspace.WorkspaceStorage.Attachment("Hallo".getBytes(java.nio.charset.StandardCharsets.UTF_8))));
        assertThat(storage.attachment(owner, 1, 1).bytes()).isEqualTo("Hallo".getBytes(java.nio.charset.StandardCharsets.UTF_8));
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

    private static final String TEST_PASSWORD = "Nur-im-Test-12345";
    private Accounts.User regularUser() {
        String id = java.util.UUID.randomUUID().toString();
        return accounts.insert(new Accounts.User(id, id + "@example.test", "Testbenutzer",
            new BCryptPasswordEncoder(10).encode(TEST_PASSWORD)));
    }
    private MockHttpSession loginAs(String email, String password) throws Exception {
        var result = mvc.perform(post("/api/v1/auth/login").with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(json.writeValueAsString(Map.of("email", email, "password", password))))
            .andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    @Test void administratorCanCreateDeactivateAndReactivateAccountsWithoutDeletingData() throws Exception {
        MockHttpSession administrator = login();
        String email = java.util.UUID.randomUUID() + "@example.test";
        var created = mvc.perform(post("/api/v1/users").session(administrator).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(json.writeValueAsString(Map.of("name", "Neues Konto", "email", email, "password", TEST_PASSWORD))))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.administrator").value(false))
            .andExpect(jsonPath("$.active").value(true)).andReturn().getResponse().getContentAsString();
        assertThat(created).doesNotContain("password", TEST_PASSWORD, "sessionVersion");
        String id = json.readTree(created).get("id").stringValue();
        MockHttpSession user = loginAs(email, TEST_PASSWORD);
        mvc.perform(get("/api/v1/workspace").session(user)).andExpect(jsonPath("$.data.projects").isEmpty());
        var settings = new WorkspaceDtos.Settings(1, new WorkspaceDtos.SettingsValues("light", "projects", "high"));
        storage.saveSettings(id, settings);
        mvc.perform(put("/api/v1/users/" + id + "/active").session(administrator).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content("{\"active\":false}")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/workspace").session(user)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("email", email, "password", TEST_PASSWORD))))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"));
        mvc.perform(put("/api/v1/users/" + id + "/active").session(administrator).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content("{\"active\":true}")).andExpect(status().isOk());
        MockHttpSession reactivated = loginAs(email, TEST_PASSWORD);
        mvc.perform(get("/api/v1/me/settings").session(reactivated)).andExpect(jsonPath("$.settings.themeMode").value("light"));
    }

    @Test void regularUsersCannotManageAccountsOrGrantThemselvesPrivileges() throws Exception {
        var account = regularUser();
        MockHttpSession user = loginAs(account.email(), TEST_PASSWORD);
        mvc.perform(get("/api/v1/users").session(user)).andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        mvc.perform(post("/api/v1/users").session(user).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content("{\"name\":\"X\",\"email\":\"x@example.test\",\"password\":\"Nur-im-Test-12345\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/me/profile").session(user).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("name", account.name(), "email", account.email(), "administrator", true))))
            .andExpect(status().isBadRequest());
        assertThat(accounts.findById(account.id()).orElseThrow().administrator()).isFalse();
    }

    @Test void passwordChangeRevokesAllSessionsAndKeepsTheWorkspace() throws Exception {
        var account = regularUser();
        MockHttpSession first = loginAs(account.email(), TEST_PASSWORD);
        MockHttpSession second = loginAs(account.email(), TEST_PASSWORD);
        var before = storage.load(account.id());
        mvc.perform(post("/api/v1/me/password").session(first).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("currentPassword", "Falsch-12345678", "newPassword", "Neues-Testpasswort-12345"))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("CURRENT_PASSWORD_INVALID"));
        mvc.perform(post("/api/v1/me/password").session(first).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("currentPassword", TEST_PASSWORD, "newPassword", "zu-kurz"))))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/me/password").session(first).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("currentPassword", TEST_PASSWORD, "newPassword", "Neues-Testpasswort-12345"))))
            .andExpect(status().isNoContent());
        assertThat(first.isInvalid()).isTrue();
        mvc.perform(get("/api/v1/auth/session").session(second)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("email", account.email(), "password", TEST_PASSWORD)))).andExpect(status().isUnauthorized());
        MockHttpSession renewed = loginAs(account.email(), "Neues-Testpasswort-12345");
        mvc.perform(get("/api/v1/workspace").session(renewed)).andExpect(jsonPath("$.revision").value(before.revision()));
        assertThat(accounts.findById(account.id()).orElseThrow().passwordHash()).doesNotContain("Neues-Testpasswort");
    }

    @Test void emailChangesKeepOwnershipAndOldSessionsCannotFollowAReusedAddress() throws Exception {
        var account = regularUser();
        MockHttpSession first = loginAs(account.email(), TEST_PASSWORD);
        MockHttpSession old = loginAs(account.email(), TEST_PASSWORD);
        var before = storage.load(account.id());
        String email = java.util.UUID.randomUUID() + "@example.test";
        mvc.perform(put("/api/v1/me/profile").session(first).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("name", "Geändert", "email", email, "currentPassword", ""))))
            .andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/me/profile").session(first).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("name", "Geändert", "email", email, "currentPassword", TEST_PASSWORD))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.user.id").value(account.id()))
            .andExpect(jsonPath("$.user.email").value(email));
        String replacementId = java.util.UUID.randomUUID().toString();
        accounts.insert(new Accounts.User(replacementId, account.email(), "Anderes Konto", new BCryptPasswordEncoder(10).encode(TEST_PASSWORD)));
        mvc.perform(get("/api/v1/workspace").session(old)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/workspace").session(first)).andExpect(jsonPath("$.revision").value(before.revision()));
        assertThat(accounts.findById(account.id()).orElseThrow().email()).isEqualTo(email);
    }

    @Test void duplicateEmailsAndAdministratorDeactivationAreRejected() throws Exception {
        MockHttpSession administrator = login();
        mvc.perform(put("/api/v1/users/initial-admin/active").session(administrator).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content("{\"active\":false}")).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("ADMIN_ACCOUNT_PROTECTED"));
        var first = regularUser();
        var other = regularUser();
        MockHttpSession user = loginAs(first.email(), TEST_PASSWORD);
        String originalSessionId = user.getId();
        mvc.perform(put("/api/v1/me/profile").session(user).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("name", "Neuer Name", "email", first.email(), "currentPassword", ""))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.user.name").value("Neuer Name"));
        assertThat(user.getId()).isEqualTo(originalSessionId);
        mvc.perform(put("/api/v1/me/profile").session(user).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("name", "Neuer Name", "email", other.email(), "currentPassword", TEST_PASSWORD))))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("EMAIL_IN_USE"));
        assertThat(accounts.findById(first.id()).orElseThrow().email()).isEqualTo(first.email());
    }

    @Test void unicodePasswordLimitIsMeasuredInBytesAndAccountWritesRequireCsrf() throws Exception {
        MockHttpSession administrator = login();
        mvc.perform(post("/api/v1/users").session(administrator).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("name", "Unicode", "email", "unicode@example.test", "password", "😀".repeat(18)))))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/users").session(administrator).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("name", "Unicode", "email", "unicode@example.test", "password", "😀".repeat(19)))))
            .andExpect(status().isBadRequest());
        String email = java.util.UUID.randomUUID() + "@example.test";
        mvc.perform(post("/api/v1/users").session(administrator).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("name", "Unicode", "email", email, "password", "😀".repeat(18)))))
            .andExpect(status().isCreated());
        loginAs(email, "😀".repeat(18));
    }

    @Test void repeatedIncorrectCurrentPasswordsAreLimitedWithoutChangingCredentials() throws Exception {
        var account = regularUser();
        MockHttpSession user = loginAs(account.email(), TEST_PASSWORD);
        for (int index = 0; index < 10; index++) {
            mvc.perform(post("/api/v1/me/password").session(user).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
                .content(json.writeValueAsString(Map.of("currentPassword", "Falsch-12345678", "newPassword", "Neues-Passwort-12345"))))
                .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/v1/me/password").session(user).with(csrf()).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(Map.of("currentPassword", TEST_PASSWORD, "newPassword", "Neues-Passwort-12345"))))
            .andExpect(status().isTooManyRequests());
        assertThat(accounts.findById(account.id()).orElseThrow().passwordHash()).isEqualTo(account.passwordHash());
        mvc.perform(get("/api/v1/auth/session").session(user)).andExpect(status().isOk());
    }
}
