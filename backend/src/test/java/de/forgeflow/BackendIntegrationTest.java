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

@SpringBootTest(properties={"forgeflow.ai.enabled=false", "forgeflow.user.id=initial-admin", "forgeflow.user.email=admin@example.test", "server.servlet.session.cookie.secure=false", "logging.level.root=WARN", "logging.level.org.springframework=WARN", "debug=false"})
@AutoConfigureMockMvc
@ActiveProfiles("memory")
class BackendIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired Accounts accounts;
    @Autowired WorkspaceStorage storage;
    @Autowired de.forgeflow.rest.RestCollectionsStorage restCollections;
    protected de.forgeflow.rest.RestCollections restFixture() {
        return new de.forgeflow.rest.RestCollections(1, "rest-initial", java.util.List.of(new de.forgeflow.rest.RestCollections.Collection(
            java.util.UUID.randomUUID(), "Private collection", java.util.List.of(new de.forgeflow.rest.RestCollections.SavedRequest(java.util.UUID.randomUUID(), "Request",
                new de.forgeflow.rest.RestCollections.Draft("POST", "https://example.test/api", "X-Test: synthetic-private-marker", "{\"large\":90071992547409931234,\"text\":\"Grüße 😀\"}", "json", 47))))));
    }
    @Test void privateRestCollectionsRequireSessionCsrfOriginAndMatchingRevisionAndNeverEnterWorkspace() throws Exception {
        String path = "/api/v1/me/rest-collections";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        var owner = regularUser(); var session = loginAs(owner.email(), TEST_PASSWORD); var input = restFixture(); var body = json.writeValueAsString(input);
        mvc.perform(get(path).session(session)).andExpect(status().isOk()).andExpect(header().string("ETag", "\"rest-initial\""));
        mvc.perform(put(path).session(session).header("Origin", ORIGIN).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(put(path).session(session).with(csrf()).header("Origin", "https://foreign.example").contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(put(path).session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body)).andExpect(status().isPreconditionRequired());
        mvc.perform(put(path).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"wrong\"").contentType("application/json").content(body)).andExpect(status().isUnprocessableEntity());
        mvc.perform(put(path).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"rest-initial\"").contentType("application/json").content(body)).andExpect(status().isOk());
        var saved = restCollections.load(owner.id()); assertThat(saved.collections()).isEqualTo(input.collections()); assertThat(saved.revision()).isNotEqualTo(input.revision());
        mvc.perform(put(path).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"rest-initial\"").contentType("application/json").content(body)).andExpect(status().isConflict());
        var other = regularUser(); mvc.perform(get(path).session(loginAs(other.email(), TEST_PASSWORD))).andExpect(jsonPath("$.collections").isEmpty());
        var workspace = storage.load(owner.id()); storage.save(owner.id(), workspace.revision(), workspace.data(), Map.of());
        assertThat(restCollections.load(owner.id())).isEqualTo(saved);
        mvc.perform(get("/api/v1/workspace").session(session)).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("synthetic-private-marker"))));
        assertThat(saved.toString() + saved.collections().getFirst() + saved.collections().getFirst().requests().getFirst().draft()).doesNotContain("synthetic-private-marker", "example.test");
        restCollections.save(owner.id(), new de.forgeflow.rest.RestCollections(1, saved.revision(), java.util.List.of()));
        mvc.perform(get(path).session(session)).andExpect(jsonPath("$.collections").isEmpty());
    }
    @Test void privateRestValidationRejectsUnsafeUrlsDuplicateIdsAndOversizePayloadsWithoutPartialWrites() throws Exception {
        var owner = regularUser(); var session = loginAs(owner.email(), TEST_PASSWORD); var input = restFixture();
        String body = json.writeValueAsString(input); var collection = input.collections().getFirst(); var request = collection.requests().getFirst();
        for (String invalid : java.util.List.of(body.replace("https://example.test/api", "file:///etc/passwd"), body.replace("https://example.test/api", "https://user:pass@example.test"), body.replace(request.id().toString(), collection.id().toString()))) {
            mvc.perform(put("/api/v1/me/rest-collections").session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"rest-initial\"").contentType("application/json").content(invalid)).andExpect(status().isUnprocessableEntity());
        }
        mvc.perform(put("/api/v1/me/rest-collections").session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"rest-initial\"").contentType("application/json").content(body.replace("\"timeout\":47", "\"timeout\":121"))).andExpect(status().isBadRequest());
        var requests = java.util.stream.IntStream.range(0, 6).mapToObj(index -> new de.forgeflow.rest.RestCollections.SavedRequest(java.util.UUID.randomUUID(), "Large draft", new de.forgeflow.rest.RestCollections.Draft("GET", "", "", "ü".repeat(100000), "text", 30))).toList();
        var oversized = new de.forgeflow.rest.RestCollections(1, "rest-initial", java.util.List.of(new de.forgeflow.rest.RestCollections.Collection(java.util.UUID.randomUUID(), "Large", requests)));
        mvc.perform(put("/api/v1/me/rest-collections").session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"rest-initial\"").contentType("application/json").content(json.writeValueAsString(oversized))).andExpect(status().isPayloadTooLarge());
        assertThat(restCollections.load(owner.id())).isEqualTo(de.forgeflow.rest.RestCollections.empty());
    }
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
    @Test void globalIndustriesAreSharedButOnlyAdministratorsCanChangeThemWithCsrfOriginAndRevision() throws Exception {
        String path = "/api/v1/settings/global";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        var administrator = login(); var ordinary = regularUser(); var user = loginAs(ordinary.email(), TEST_PASSWORD);
        var original = storage.loadGlobalSettings();
        String request = json.writeValueAsString(new de.forgeflow.workspace.GlobalSettings(original.revision(), java.util.List.of("  Testbranche Ü  ", "Zweite Branche")));
        mvc.perform(get(path).session(user)).andExpect(status().isOk());
        mvc.perform(put(path).session(user).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + original.revision() + "\"").contentType("application/json").content(request)).andExpect(status().isForbidden());
        mvc.perform(put(path).session(administrator).header("Origin", ORIGIN).contentType("application/json").content(request)).andExpect(status().isForbidden());
        mvc.perform(put(path).session(administrator).with(csrf()).header("Origin", "https://foreign.example").contentType("application/json").content(request)).andExpect(status().isForbidden());
        mvc.perform(put(path).session(administrator).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(request)).andExpect(status().isPreconditionRequired());
        mvc.perform(put(path).session(administrator).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + original.revision() + "\"").contentType("application/json").content(request))
            .andExpect(status().isOk()).andExpect(jsonPath("$.industries[0]").value("Testbranche Ü"));
        mvc.perform(get(path).session(user)).andExpect(jsonPath("$.industries[0]").value("Testbranche Ü"));
        mvc.perform(put(path).session(administrator).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + original.revision() + "\"").contentType("application/json").content(request)).andExpect(status().isConflict());
        var saved = storage.loadGlobalSettings();
        for (var names : java.util.List.of(java.util.List.of("Same", "same"), java.util.List.<String>of(), java.util.List.of("bad\nvalue"))) {
            String invalid = json.writeValueAsString(new de.forgeflow.workspace.GlobalSettings(saved.revision(), names));
            mvc.perform(put(path).session(administrator).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + saved.revision() + "\"").contentType("application/json").content(invalid)).andExpect(status().is(names.isEmpty() ? 400 : 422));
        }
        assertThat(storage.loadGlobalSettings()).isEqualTo(saved);
        storage.saveGlobalSettings(new de.forgeflow.workspace.GlobalSettings(saved.revision(), original.industries()));
    }
    @Test void customerPostalCodeRoundTripsAsTextAndLegacyManifestsRemainReadable() throws Exception {
        var account = regularUser(); var session = loginAs(account.email(), TEST_PASSWORD); var previous = storage.load(account.id());
        var customer = new WorkspaceDtos.Customer(1, "Postal test", "Street 1", "Berlin", "Deutschland", "", "", "", "Legacy industry", "01234");
        var empty = WorkspaceDtos.Data.empty(); var data = new WorkspaceDtos.Data(empty.projects(), java.util.List.of(customer), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki());
        var body = json.writeValueAsString(new WorkspaceDtos.Envelope(1, previous.revision(), data));
        mvc.perform(multipart("/api/v1/workspace").param("manifest", body).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + previous.revision() + "\"")
            .with(request -> { request.setMethod("PUT"); return request; })).andExpect(status().isOk());
        mvc.perform(get("/api/v1/workspace").session(session)).andExpect(jsonPath("$.data.customers[0].postalCode").value("01234"));
        var node = (tools.jackson.databind.node.ObjectNode) json.valueToTree(customer); node.remove("postalCode");
        assertThat(json.treeToValue(node, WorkspaceDtos.Customer.class).postalCode()).isEmpty();
    }
    @Test void disabledAiReturnsAStructuredErrorWithoutRequiringAProviderKey() throws Exception {
        mvc.perform(post("/api/v1/ai/conversations").session(login()).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content("{}"))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("AI_DISABLED"));
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
    @Test void settingsLanguageIsValidatedAndMissingLanguageDefaultsToGerman() throws Exception {
        MockHttpSession session = login();
        String legacy = "{\"version\":1,\"settings\":{\"themeMode\":\"light\",\"defaultProjectView\":\"projects\",\"defaultTaskPriority\":\"high\"}}";
        mvc.perform(put("/api/v1/me/settings").session(session).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(legacy)).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me/settings").session(session)).andExpect(jsonPath("$.settings.language").value("de"));
        String english = legacy.replace("\"high\"", "\"high\",\"language\":\"en\"");
        mvc.perform(put("/api/v1/me/settings").session(session).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(english)).andExpect(status().isNoContent());
        mvc.perform(put("/api/v1/me/settings").session(session).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(english.replace("\"en\"", "\"fr\""))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/me/settings").session(session)).andExpect(jsonPath("$.settings.language").value("en"));
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
    @Test void customerDetailsAreAccountLocalValidateRelationsAndSurviveLegacyFieldOmissions() throws Exception {
        var account = regularUser(); var session = loginAs(account.email(), TEST_PASSWORD); var before = storage.load(account.id());
        var contact = new WorkspaceDtos.CustomerContact(1, 1, "Contact Ü", "Manager", "contact@example.test", "+49 123");
        var customer = new WorkspaceDtos.Customer(1, "Customer", "", "", "", "", "", "", "", "01234", java.util.List.of(contact), "  Note 😀\n");
        var empty = WorkspaceDtos.Data.empty(); var data = new WorkspaceDtos.Data(empty.projects(), java.util.List.of(customer), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki());
        var manifest = new WorkspaceDtos.Envelope(1, before.revision(), data);
        mvc.perform(multipart("/api/v1/workspace").param("manifest", json.writeValueAsString(manifest)).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + before.revision() + "\"")
            .with(request -> { request.setMethod("PUT"); return request; })).andExpect(status().isOk());
        mvc.perform(get("/api/v1/workspace").session(session)).andExpect(jsonPath("$.data.customers[0].contacts[0].name").value("Contact Ü")).andExpect(jsonPath("$.data.customers[0].notes").value("  Note 😀\n"));
        var other = regularUser(); mvc.perform(get("/api/v1/workspace").session(loginAs(other.email(), TEST_PASSWORD))).andExpect(jsonPath("$.data.customers").isEmpty());
        var current = storage.load(account.id()); var node = json.valueToTree(current);
        var legacyCustomer = (tools.jackson.databind.node.ObjectNode) node.get("data").get("customers").get(0); legacyCustomer.remove("contacts"); legacyCustomer.remove("notes"); legacyCustomer.put("name", "Legacy rename");
        mvc.perform(multipart("/api/v1/workspace").param("manifest", node.toString()).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + current.revision() + "\"")
            .with(request -> { request.setMethod("PUT"); return request; })).andExpect(status().isOk());
        var saved = storage.load(account.id()); assertThat(saved.data().customers().getFirst().contacts()).containsExactly(contact); assertThat(saved.data().customers().getFirst().notes()).isEqualTo(customer.notes());
        var invalid = json.valueToTree(saved); ((tools.jackson.databind.node.ObjectNode) invalid.get("data").get("customers").get(0).get("contacts").get(0)).put("customerId", 999);
        mvc.perform(multipart("/api/v1/workspace").param("manifest", invalid.toString()).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + saved.revision() + "\"")
            .with(request -> { request.setMethod("PUT"); return request; })).andExpect(status().isUnprocessableEntity());
        assertThat(storage.load(account.id())).isEqualTo(saved);
        var cleared = json.valueToTree(saved); var target = (tools.jackson.databind.node.ObjectNode) cleared.get("data").get("customers").get(0); target.set("contacts", json.createArrayNode()); target.put("notes", "");
        mvc.perform(multipart("/api/v1/workspace").param("manifest", cleared.toString()).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + saved.revision() + "\"")
            .with(request -> { request.setMethod("PUT"); return request; })).andExpect(status().isOk());
        assertThat(storage.load(account.id()).data().customers().getFirst().contacts()).isEmpty();
    }
    @Test void documentationHierarchyIsOwnedAtomicAndCompatibleWithOlderClients() throws Exception {
        var account = regularUser(); var session = loginAs(account.email(), TEST_PASSWORD); var initial = storage.load(account.id());
        var now = "2026-10-24T10:00:00Z"; var empty = WorkspaceDtos.Data.empty();
        var pages = java.util.List.of(new WorkspaceDtos.Article(1, "Child", "Child text", 1L, now, now, 9L), new WorkspaceDtos.Article(9, "Root", "# Root", 1L, now, now));
        var spaces = java.util.List.of(new WorkspaceDtos.Category(1, "Docs", "Existing space", now, now), new WorkspaceDtos.Category(2, "Other", "", now, now));
        var data = new WorkspaceDtos.Data(empty.projects(), empty.customers(), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), new WorkspaceDtos.Wiki(pages, spaces));
        mvc.perform(multipart("/api/v1/workspace").param("manifest", json.writeValueAsString(new WorkspaceDtos.Envelope(1, initial.revision(), data)))
            .session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + initial.revision() + "\"").with(request -> { request.setMethod("PUT"); return request; })).andExpect(status().isOk());
        var saved = storage.load(account.id()); assertThat(saved.data().wiki().articles()).containsExactlyElementsOf(pages);
        var legacy = json.valueToTree(saved); ((tools.jackson.databind.node.ObjectNode) legacy.path("data").path("wiki").path("articles").get(0)).remove("parentId");
        mvc.perform(multipart("/api/v1/workspace").param("manifest", legacy.toString()).session(session).with(csrf()).header("Origin", ORIGIN)
            .header("If-Match", "\"" + saved.revision() + "\"").with(request -> { request.setMethod("PUT"); return request; })).andExpect(status().isOk());
        saved = storage.load(account.id()); assertThat(saved.data().wiki().articles().getFirst().parentId()).isEqualTo(9L);
        var other = regularUser(); mvc.perform(get("/api/v1/workspace").session(loginAs(other.email(), TEST_PASSWORD))).andExpect(jsonPath("$.data.wiki.articles").isEmpty());
        for (String invalid : java.util.List.of("cycle", "foreign", "space", "delete")) {
            var node = json.valueToTree(saved); var items = (tools.jackson.databind.node.ArrayNode) node.path("data").path("wiki").path("articles");
            if (invalid.equals("cycle")) ((tools.jackson.databind.node.ObjectNode) items.get(1)).put("parentId", 1);
            if (invalid.equals("foreign")) ((tools.jackson.databind.node.ObjectNode) items.get(0)).put("parentId", 99);
            if (invalid.equals("space")) ((tools.jackson.databind.node.ObjectNode) items.get(0)).put("categoryId", 2);
            if (invalid.equals("delete")) items.remove(1);
            mvc.perform(multipart("/api/v1/workspace").param("manifest", node.toString()).session(session).with(csrf()).header("Origin", ORIGIN)
                .header("If-Match", "\"" + saved.revision() + "\"").with(request -> { request.setMethod("PUT"); return request; })).andExpect(status().isUnprocessableEntity());
            assertThat(storage.load(account.id())).isEqualTo(saved);
        }
        var root = json.valueToTree(saved); ((tools.jackson.databind.node.ObjectNode) root.path("data").path("wiki").path("articles").get(0)).putNull("parentId");
        mvc.perform(multipart("/api/v1/workspace").param("manifest", root.toString()).session(session).with(csrf()).header("Origin", ORIGIN)
            .header("If-Match", "\"" + saved.revision() + "\"").with(request -> { request.setMethod("PUT"); return request; })).andExpect(status().isOk());
        assertThat(storage.load(account.id()).data().wiki().articles().getFirst().parentId()).isNull();
    }

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
