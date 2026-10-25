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
    @Autowired de.forgeflow.time.TimeTrackingStorage timeTracking;
    @Autowired de.forgeflow.business.BusinessStorage business;
    @Autowired de.forgeflow.business.PortalStorage portalLinks;
    @Autowired de.forgeflow.business.PdfReports pdfReports;
    private MockHttpSession businessLogin(String email, String password) throws Exception {
        var response = mvc.perform(post("/api/v1/auth/login").with(csrf()).header("Origin", ORIGIN)
            .with(request -> { request.setRemoteAddr("127.2." + Math.floorMod(email.hashCode(), 200) + "." + Math.floorMod(password.hashCode(), 200)); return request; })
            .contentType("application/json").content(json.writeValueAsString(Map.of("email", email, "password", password)))).andExpect(status().isOk()).andReturn();
        return (MockHttpSession) response.getRequest().getSession(false);
    }
    private void businessWorkspace(String owner) {
        var empty = WorkspaceDtos.Data.empty();
        var customers = java.util.List.of(new WorkspaceDtos.Customer(1, "Public customer", "Test street 1", "Town", "DE", "public@example.test", "", "", "IT", "01234"), new WorkspaceDtos.Customer(2, "Private customer", "", "", "", "", "", "", ""));
        var projects = java.util.List.of(new WorkspaceDtos.Project(1, 1, "Public project", false, "2026-12-31"), new WorkspaceDtos.Project(2, 2, "Private project", false, "2026-12-31"));
        var wiki = new WorkspaceDtos.Wiki(java.util.List.of(new WorkspaceDtos.Article(9, "Public page", "# Shared documentation", null, "2026-10-25", "2026-10-25"), new WorkspaceDtos.Article(10, "Private page", "Private page contents", null, "2026-10-25", "2026-10-25")), java.util.List.of());
        storage.save(owner, storage.load(owner).revision(), new WorkspaceDtos.Data(projects, customers, empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), wiki), Map.of());
    }
    private de.forgeflow.business.BusinessData businessInput(String owner, java.util.List<de.forgeflow.business.BusinessData.Document> documents) {
        var current = business.load(owner);
        return new de.forgeflow.business.BusinessData(1, current.revision(), new de.forgeflow.business.BusinessData.Profile("ForgeFlow Test Company", "Test street 2\n01234 Town", "billing@example.test", "Test VAT ID", "Test bank details", "EUR", 1900, 15000, 14), current.budgets(), current.templates(), documents, current.timer());
    }
    private de.forgeflow.business.BusinessData.Document businessDocument(String kind) {
        return new de.forgeflow.business.BusinessData.Document(java.util.UUID.randomUUID(), kind, 1, 1L, "Professional services", "2026-10-25", "2026-11-08", "draft", "", "", "", "EUR", java.util.List.of(new de.forgeflow.business.BusinessData.Line("Project work", "1.5", 15000, 1900, 0)), java.util.List.of(), "Payment within 14 days.\nThank you for your trust.");
    }
    private de.forgeflow.business.BusinessData saveBusiness(MockHttpSession session, de.forgeflow.business.BusinessData input) throws Exception {
        var response = mvc.perform(put("/api/v1/me/business").session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + input.revision() + "\"")
            .contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isOk()).andReturn().getResponse();
        var value = json.readValue(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8), de.forgeflow.business.BusinessData.class);
        assertThat(response.getHeader("ETag")).isEqualTo("\"" + value.revision() + "\""); return value;
    }
    @Test void businessDocumentsUseExactMoneyAndBecomeImmutableAfterIssuing() throws Exception {
        var owner = regularUser(); var session = businessLogin(owner.email(), TEST_PASSWORD); businessWorkspace(owner.id());
        var document = businessDocument("invoice"); var input = businessInput(owner.id(), java.util.List.of(document));
        mvc.perform(get("/api/v1/me/business")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/me/business").session(session).header("Origin", ORIGIN).contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isForbidden());
        saveBusiness(session, input);
        var saved = saveBusiness(session, businessInput(owner.id(), java.util.List.of(document.with("issued", "forged-number", "forged sender", "forged recipient"))));
        var issued = saved.documents().getFirst(); assertThat(issued.number()).isEqualTo("INV-2026-00001"); assertThat(issued.issuer()).contains("ForgeFlow Test Company"); assertThat(issued.recipient()).contains("Public customer");
        assertThat(de.forgeflow.business.BusinessRules.totals(issued)).containsExactly(22500, 4275, 26775);
        assertThat(de.forgeflow.business.BusinessRules.net(new de.forgeflow.business.BusinessData.Line("Exact minutes", "1", 15, 0, 2))).isEqualTo(1);
        var forbidden = businessInput(owner.id(), java.util.List.of(issued.with("draft", issued.number(), issued.issuer(), issued.recipient())));
        mvc.perform(put("/api/v1/me/business").session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + forbidden.revision() + "\"").contentType("application/json").content(json.writeValueAsString(forbidden))).andExpect(status().isUnprocessableEntity());
        saveBusiness(session, businessInput(owner.id(), java.util.List.of(issued.with("paid", issued.number(), issued.issuer(), issued.recipient()))));
        var other = regularUser(); assertThat(business.load(other.id()).documents()).isEmpty();
        mvc.perform(get("/api/v1/me/business/documents/" + issued.id() + "/pdf").session(businessLogin(other.email(), TEST_PASSWORD))).andExpect(status().isNotFound());
    }
    @Test void projectTemplatesCreateOneAtomicWorkspaceAndRejectStaleVersions() throws Exception {
        var owner = regularUser(); var session = businessLogin(owner.email(), TEST_PASSWORD); businessWorkspace(owner.id());
        var template = new de.forgeflow.business.BusinessData.Template(java.util.UUID.randomUUID(), "Website template", "Reusable delivery", java.util.List.of(new de.forgeflow.business.BusinessData.TemplateTask("Plan delivery", "Detailed task", "high")), java.util.List.of("Launch"), java.util.List.of(new de.forgeflow.business.BusinessData.TemplatePage("Project guide", "# Instructions")));
        var input = businessInput(owner.id(), java.util.List.of()); var saved = saveBusiness(session, new de.forgeflow.business.BusinessData(1, input.revision(), input.profile(), java.util.List.of(new de.forgeflow.business.BusinessData.Budget(1, 2400, 15000)), java.util.List.of(template), input.documents(), null));
        var body = Map.of("revision", saved.revision(), "workspaceRevision", storage.load(owner.id()).revision(), "customerId", 1, "name", "Created from template", "deadline", "2026-12-31");
        mvc.perform(post("/api/v1/me/business/templates/" + template.id() + "/apply").session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isOk());
        var data = storage.load(owner.id()).data(); assertThat(data.projects()).hasSize(3); assertThat(data.tasks()).hasSize(1); assertThat(data.epics()).hasSize(1); assertThat(data.wiki().articles()).hasSize(3);
        mvc.perform(post("/api/v1/me/business/templates/" + template.id() + "/apply").session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isConflict());
        assertThat(storage.load(owner.id()).data().projects()).hasSize(3);
    }
    @Test void portalAccountsNeverAccessInternalApisAndOnlyReceiveExplicitShares() throws Exception {
        var owner = regularUser(); var session = businessLogin(owner.email(), TEST_PASSWORD); businessWorkspace(owner.id()); String email = java.util.UUID.randomUUID() + "@portal.example.test";
        var created = mvc.perform(post("/api/v1/me/business/portal-accounts").session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(json.writeValueAsString(Map.of("name", "Customer portal", "email", email, "password", TEST_PASSWORD, "customerId", 1)))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = json.readTree(created).get("user").get("id").stringValue(); assertThat(accounts.findById(id).orElseThrow().portalOnly()).isTrue();
        var portal = businessLogin(email, TEST_PASSWORD);
        for (var path : java.util.List.of("/api/v1/workspace", "/api/v1/me/time-tracking", "/api/v1/me/business", "/api/v1/settings/global", "/api/v1/users")) mvc.perform(get(path).session(portal)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/portal/home").session(portal)).andExpect(jsonPath("$.projects").isEmpty()).andExpect(jsonPath("$.articles").isEmpty());
        var original = portalLinks.find(id).orElseThrow();
        var grant = new de.forgeflow.business.PortalLink(id, owner.id(), original.revision(), 1, true, java.util.List.of(1L), java.util.List.of(9L), java.util.List.of(), java.util.List.of(), java.util.List.of("2026-10"));
        var response = mvc.perform(put("/api/v1/me/business/portal-accounts/" + id).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + grant.revision() + "\"").contentType("application/json").content(json.writeValueAsString(grant))).andExpect(status().isOk()).andReturn().getResponse();
        var shared = json.readValue(response.getContentAsString(), de.forgeflow.business.PortalLink.class);
        var home = mvc.perform(get("/api/v1/portal/home").session(portal)).andExpect(jsonPath("$.projects[0].name").value("Public project")).andExpect(jsonPath("$.articles[0].title").value("Public page")).andReturn().getResponse().getContentAsString();
        assertThat(home).doesNotContain("Private project", "Private page contents", "passwordHash", "Private customer");
        var reused = WorkspaceDtos.Data.empty();
        storage.save(owner.id(), storage.load(owner.id()).revision(), new WorkspaceDtos.Data(java.util.List.of(new WorkspaceDtos.Project(1, 1, "Reused private project", false, "2027-01-01")), java.util.List.of(new WorkspaceDtos.Customer(1, "Reused private customer", "", "", "", "", "", "", "")), reused.tasks(), reused.activities(), reused.epics(), reused.sprints(), reused.files(), new WorkspaceDtos.Wiki(java.util.List.of(new WorkspaceDtos.Article(9, "Reused private page", "Reused private contents", null, "2026-10-26", "2026-10-26")), java.util.List.of())), Map.of());
        var stable = mvc.perform(get("/api/v1/portal/home").session(portal)).andExpect(jsonPath("$.projects[0].name").value("Public project")).andReturn().getResponse().getContentAsString();
        assertThat(stable).doesNotContain("Reused private");
        mvc.perform(get("/api/v1/portal/documents/" + java.util.UUID.randomUUID() + "/pdf").session(portal)).andExpect(status().isNotFound());
        var revoked = new de.forgeflow.business.PortalLink(id, owner.id(), shared.revision(), 1, false, shared.projectIds(), shared.articleIds(), shared.fileIds(), shared.documentIds(), shared.reportMonths());
        storage.save(owner.id(), storage.load(owner.id()).revision(), WorkspaceDtos.Data.empty(), Map.of());
        mvc.perform(put("/api/v1/me/business/portal-accounts/" + id).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + revoked.revision() + "\"").contentType("application/json").content(json.writeValueAsString(revoked))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/portal/home").session(portal)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/me/password").session(portal).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(json.writeValueAsString(Map.of("currentPassword", TEST_PASSWORD, "newPassword", "Changed-Portal-12345")))).andExpect(status().isNoContent());
        assertThat(accounts.findById(id).orElseThrow().portalOnly()).isTrue();
    }
    @Test void stopwatchPersistsPauseResumeAndRequiresSavedTimeBeforeCompletion() throws Exception {
        var owner = regularUser(); var session = businessLogin(owner.email(), TEST_PASSWORD);
        var input = new de.forgeflow.business.BusinessController.TimerInput("Europe/Berlin", null, null, "Timer notes", true);
        String path = "/api/v1/me/business/timer/";
        for (String action : java.util.List.of("start", "pause", "resume", "pause")) {
            var value = business.load(owner.id()); mvc.perform(post(path + action).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + value.revision() + "\"").contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isOk());
        }
        var current = business.load(owner.id()); assertThat(current.timer().startedAt()).isNull();
        mvc.perform(post(path + "complete").session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + current.revision() + "\"").contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isUnprocessableEntity());
        timeTracking.save(owner.id(), new de.forgeflow.time.TimeTracking(1, "time-initial", java.util.List.of(timeEntry(current.timer().id(), 0, null, null))));
        mvc.perform(post(path + "complete").session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + current.revision() + "\"").contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isOk());
        assertThat(business.load(owner.id()).timer()).isNull();
    }
    @Test void generatedBusinessPdfsAreReadableAndRenderWithoutClippedPageBounds() throws Exception {
        var directory = java.nio.file.Path.of("target", "pdf-qa"); java.nio.file.Files.createDirectories(directory);
        var entry = timeEntry(java.util.UUID.randomUUID(), 540, 1L, 1L).names("Müller & Söhne", "Website launch");
        for (String kind : java.util.List.of("invoice", "offer", "timesheet")) {
            var value = businessDocument(kind.equals("offer") ? "offer" : "invoice").with("draft", "", "ForgeFlow Test Company\nTest street 2\n01234 Town", "Müller & Söhne\nExample street 1\n01234 Town");
            byte[] bytes = kind.equals("timesheet") ? pdfReports.timesheet(java.util.Collections.nCopies(35, entry), "Müller & Söhne", "2026-10", true, "de") : pdfReports.document(value, "de");
            java.nio.file.Files.write(directory.resolve(kind + ".pdf"), bytes);
            try (var document = org.apache.pdfbox.Loader.loadPDF(bytes)) {
                assertThat(new org.apache.pdfbox.text.PDFTextStripper().getText(document)).contains("ForgeFlow", "Müller");
                var renderer = new org.apache.pdfbox.rendering.PDFRenderer(document);
                javax.imageio.ImageIO.write(renderer.renderImageWithDPI(0, 100), "png", directory.resolve(kind + "-first.png").toFile());
                javax.imageio.ImageIO.write(renderer.renderImageWithDPI(document.getNumberOfPages() - 1, 100), "png", directory.resolve(kind + "-last.png").toFile());
            }
        }
    }
    private de.forgeflow.time.TimeTracking.Entry timeEntry(java.util.UUID id, int start, Long customer, Long project) {
        return new de.forgeflow.time.TimeTracking.Entry(id, "2026-10-26", start, 60, 15, customer, project, "untrusted customer", "untrusted project", "Private work notes 😀", true);
    }
    private de.forgeflow.time.TimeTracking putTime(MockHttpSession session, de.forgeflow.time.TimeTracking value) throws Exception {
        var response = mvc.perform(put("/api/v1/me/time-tracking").session(session).with(csrf()).header("Origin", ORIGIN)
            .header("If-Match", "\"" + value.revision() + "\"").contentType("application/json").content(json.writeValueAsString(value)))
            .andExpect(status().isOk()).andReturn().getResponse();
        var saved = json.readValue(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8), de.forgeflow.time.TimeTracking.class);
        assertThat(response.getHeader("ETag")).isEqualTo("\"" + saved.revision() + "\""); return saved;
    }
    @Test void timeTrackingIsPrivateProtectedAndDetectsConflictingWrites() throws Exception {
        String path = "/api/v1/me/time-tracking";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        var owner = regularUser(); var session = loginAs(owner.email(), TEST_PASSWORD);
        mvc.perform(get(path).session(session)).andExpect(jsonPath("$.entries").isEmpty());
        var input = new de.forgeflow.time.TimeTracking(1, "time-initial", java.util.List.of(timeEntry(java.util.UUID.randomUUID(), 540, null, null)));
        mvc.perform(put(path).session(session).header("Origin", ORIGIN).contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isForbidden());
        mvc.perform(put(path).session(session).with(csrf()).header("Origin", "https://wrong.example.test").contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isForbidden());
        mvc.perform(put(path).session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().is(428));
        var saved = putTime(session, input);
        assertThat(saved.entries().getFirst().customerName()).isEmpty();
        mvc.perform(put(path).session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"time-initial\"")
            .contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isConflict());
        mvc.perform(get(path).session(session)).andExpect(jsonPath("$.entries[0].comment").value("Private work notes 😀"));
        var other = regularUser(); var otherSession = loginAs(other.email(), TEST_PASSWORD);
        mvc.perform(get(path).session(otherSession)).andExpect(jsonPath("$.entries").isEmpty());
        putTime(session, new de.forgeflow.time.TimeTracking(1, saved.revision(), java.util.List.of()));
        assertThat(timeTracking.load(owner.id()).entries()).isEmpty();
    }
    @Test void timeTrackingResolvesOwnCustomerProjectAndRetainsHistoryAfterTheirDeletion() throws Exception {
        var owner = regularUser(); var session = loginAs(owner.email(), TEST_PASSWORD); var empty = WorkspaceDtos.Data.empty();
        var customer = new WorkspaceDtos.Customer(51, "Actual customer", "", "", "", "", "", "", "");
        var project = new WorkspaceDtos.Project(61, 51, "Actual project", false, "2026-12-31");
        storage.save(owner.id(), storage.load(owner.id()).revision(), new WorkspaceDtos.Data(java.util.List.of(project), java.util.List.of(customer), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki()), Map.of());
        var entry = timeEntry(java.util.UUID.randomUUID(), 540, 51L, 61L);
        var saved = putTime(session, new de.forgeflow.time.TimeTracking(1, "time-initial", java.util.List.of(entry)));
        assertThat(saved.entries().getFirst().customerName()).isEqualTo("Actual customer");
        assertThat(saved.entries().getFirst().projectName()).isEqualTo("Actual project");
        var renamed = new WorkspaceDtos.Customer(51, "Renamed customer", "", "", "", "", "", "", "");
        var second = new WorkspaceDtos.Customer(52, "New project owner", "", "", "", "", "", "", "");
        var moved = new WorkspaceDtos.Project(61, 52, "Renamed project", false, "2026-12-31");
        storage.save(owner.id(), storage.load(owner.id()).revision(), new WorkspaceDtos.Data(java.util.List.of(moved), java.util.List.of(renamed, second), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki()), Map.of());
        saved = putTime(session, new de.forgeflow.time.TimeTracking(1, saved.revision(), java.util.List.of(entry)));
        assertThat(saved.entries().getFirst().customerName()).isEqualTo("Actual customer");
        assertThat(saved.entries().getFirst().projectName()).isEqualTo("Actual project");
        var other = regularUser();
        assertThatThrownBy(() -> timeTracking.save(other.id(), new de.forgeflow.time.TimeTracking(1, "time-initial", java.util.List.of(entry)))).isInstanceOf(de.forgeflow.api.ApiFailure.class);
        storage.save(owner.id(), storage.load(owner.id()).revision(), empty, Map.of());
        var resaved = putTime(session, new de.forgeflow.time.TimeTracking(1, saved.revision(), java.util.List.of(entry)));
        assertThat(resaved.entries().getFirst().customerName()).isEqualTo("Actual customer");
        assertThat(resaved.entries().getFirst().projectName()).isEqualTo("Actual project");
        assertThatThrownBy(() -> timeTracking.save(owner.id(), new de.forgeflow.time.TimeTracking(1, resaved.revision(), java.util.List.of(timeEntry(java.util.UUID.randomUUID(), 800, 51L, 61L))))).isInstanceOf(de.forgeflow.api.ApiFailure.class);
    }
    @Test void concurrentTimeSavesCommitExactlyOneRevision() throws Exception {
        var owner = regularUser();
        var input = new de.forgeflow.time.TimeTracking(1, "time-initial", java.util.List.of(timeEntry(java.util.UUID.randomUUID(), 540, null, null)));
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Boolean> write = () -> { start.await(); try { timeTracking.save(owner.id(), input); return true; } catch (de.forgeflow.api.ApiFailure failure) { return false; } };
            var first = executor.submit(write); var second = executor.submit(write); start.countDown();
            assertThat(java.util.List.of(first.get(15, java.util.concurrent.TimeUnit.SECONDS), second.get(15, java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(true, false);
        }
        assertThat(timeTracking.load(owner.id()).entries()).hasSize(1);
    }
    @Test void invalidTimeBookingsDoNotOverwriteSavedEntries() throws Exception {
        var owner = regularUser(); var session = loginAs(owner.email(), TEST_PASSWORD);
        var entry = timeEntry(java.util.UUID.randomUUID(), 540, null, null);
        var saved = putTime(session, new de.forgeflow.time.TimeTracking(1, "time-initial", java.util.List.of(entry)));
        var overlap = new de.forgeflow.time.TimeTracking(1, saved.revision(), java.util.List.of(entry, timeEntry(java.util.UUID.randomUUID(), 610, null, null)));
        mvc.perform(put("/api/v1/me/time-tracking").session(session).with(csrf()).header("Origin", ORIGIN).header("If-Match", "\"" + saved.revision() + "\"")
            .contentType("application/json").content(json.writeValueAsString(overlap))).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.error.code").value("INVALID_TIME_ENTRY"));
        var midnight = timeEntry(java.util.UUID.randomUUID(), 1430, null, null);
        assertThatThrownBy(() -> timeTracking.save(owner.id(), new de.forgeflow.time.TimeTracking(1, saved.revision(), java.util.List.of(midnight)))).isInstanceOf(de.forgeflow.api.ApiFailure.class);
        var invalidDate = new de.forgeflow.time.TimeTracking.Entry(entry.id(), "2026-02-30", 540, 60, 0, null, null, "", "", "", false);
        assertThatThrownBy(() -> timeTracking.save(owner.id(), new de.forgeflow.time.TimeTracking(1, saved.revision(), java.util.List.of(invalidDate)))).isInstanceOf(de.forgeflow.api.ApiFailure.class);
        assertThat(timeTracking.load(owner.id())).isEqualTo(saved);
        putTime(session, new de.forgeflow.time.TimeTracking(1, saved.revision(), java.util.List.of(entry, timeEntry(java.util.UUID.randomUUID(), 615, null, null))));
    }
    @Test void recentActivityIsPrivateLimitedAndRecordsOnlyCommittedChanges() throws Exception {
        String path = "/api/v1/me/recent-activity"; mvc.perform(get(path)).andExpect(status().isUnauthorized());
        var user = regularUser(); var session = loginAs(user.email(), TEST_PASSWORD);
        mvc.perform(get(path).session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.entries").isEmpty());
        for (int index = 1; index <= 7; index++) {
            var previous = storage.load(user.id()); var empty = WorkspaceDtos.Data.empty();
            var customer = new WorkspaceDtos.Customer(1, "Customer " + index, "", "", "", "", "", "", "");
            var data = new WorkspaceDtos.Data(empty.projects(), java.util.List.of(customer), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki());
            storage.save(user.id(), previous.revision(), data, Map.of());
        }
        mvc.perform(get(path).session(session)).andExpect(jsonPath("$.entries.length()").value(5)).andExpect(jsonPath("$.entries[0].name").value("Customer 7")).andExpect(jsonPath("$.entries[0].kind").value("customer")).andExpect(jsonPath("$.entries[0].action").value("updated")).andExpect(jsonPath("$.entries[0].entityId").value(1));
        var saved = storage.loadRecentActivity(user.id()); var previous = storage.load(user.id());
        storage.save(user.id(), previous.revision(), previous.data(), Map.of()); assertThat(storage.loadRecentActivity(user.id())).isEqualTo(saved);
        assertThatThrownBy(() -> storage.save(user.id(), previous.revision(), WorkspaceDtos.Data.empty(), Map.of())).isInstanceOf(de.forgeflow.api.ApiFailure.class);
        assertThat(storage.loadRecentActivity(user.id())).isEqualTo(saved);
        var other = regularUser(); mvc.perform(get(path).session(loginAs(other.email(), TEST_PASSWORD))).andExpect(jsonPath("$.entries").isEmpty());
        storage.saveSettings(user.id(), new WorkspaceDtos.Settings(1, new WorkspaceDtos.SettingsValues("light", "projects", "high", "en")));
        mvc.perform(get(path).session(session)).andExpect(jsonPath("$.entries[0].kind").value("settings")).andExpect(jsonPath("$.entries[0].entityId").doesNotExist());
        storage.save(user.id(), storage.load(user.id()).revision(), WorkspaceDtos.Data.empty(), Map.of());
        assertThat(storage.loadRecentActivity(user.id())).allMatch(entry -> entry.kind().equals("settings"));
    }
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
    @Test void additionalThemesAreValidatedAndRemainAccountScoped() throws Exception {
        var account = regularUser();
        MockHttpSession session = loginAs(account.email(), TEST_PASSWORD);
        for (String theme : java.util.List.of("aurora", "dune")) {
            var settings = new WorkspaceDtos.Settings(1, new WorkspaceDtos.SettingsValues(theme, "projects", "high", "en"));
            mvc.perform(put("/api/v1/me/settings").session(session).with(csrf()).header("Origin", ORIGIN)
                .contentType("application/json").content(json.writeValueAsString(settings))).andExpect(status().isNoContent());
            mvc.perform(get("/api/v1/me/settings").session(session))
                .andExpect(jsonPath("$.settings.themeMode").value(theme))
                .andExpect(jsonPath("$.settings.language").value("en"))
                .andExpect(jsonPath("$.settings.defaultTaskPriority").value("high"));
        }
        var invalid = new WorkspaceDtos.Settings(1, new WorkspaceDtos.SettingsValues("unknown", "projects", "high", "en"));
        mvc.perform(put("/api/v1/me/settings").session(session).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest());
        assertThat(storage.loadSettings(account.id()).settings().themeMode()).isEqualTo("dune");
        var other = regularUser();
        assertThat(storage.loadSettings(other.id())).isNull();
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
