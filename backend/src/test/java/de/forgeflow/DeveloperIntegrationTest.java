package de.forgeflow;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.context.ApplicationContext;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.auth.*;
import de.forgeflow.ai.*;
import de.forgeflow.developer.*;
import de.forgeflow.workspace.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"forgeflow.ai.enabled=true","forgeflow.ai.api-key=test-only-key","forgeflow.ai.model=test-only-model","forgeflow.ai.requests-per15-minutes=100","forgeflow.integrations.secret-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","forgeflow.user.id=developer-admin","forgeflow.user.email=developer-admin@example.test","forgeflow.origin=http://localhost:5173","logging.level.root=WARN"})
@AutoConfigureMockMvc @ActiveProfiles("memory")
class DeveloperIntegrationTest {
    static final String PASSWORD="Only-for-tests-12345",ORIGIN="http://localhost:5173";
    static final String HASH=new BCryptPasswordEncoder(10).encode(PASSWORD);
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry){registry.add("forgeflow.user.password-hash",()->HASH);}
    @Autowired MockMvc mvc; @Autowired JsonMapper json; @Autowired Accounts accounts; @Autowired DeveloperStorage developers; @Autowired CredentialVault vault; @Autowired DatabaseRunner database; @Autowired TrialAccounts trials; @Autowired WorkspaceStorage workspace; @Autowired ApplicationContext context;
    @MockitoBean AiModelGateway model; @MockitoBean GitHubClient github; @MockitoBean NativeGitCloner cloner;
    Accounts.User owner(){String id=UUID.randomUUID().toString();return accounts.insert(new Accounts.User(id,id+"@example.test","Developer",HASH));}
    MockHttpSession login(Accounts.User user)throws Exception{return (MockHttpSession)mvc.perform(post("/api/v1/auth/login").with(csrf()).header("Origin",ORIGIN).contentType("application/json").content(json.writeValueAsString(Map.of("email",user.email(),"password",PASSWORD)))).andExpect(status().isOk()).andReturn().getRequest().getSession(false);}
    ResultActions postData(MockHttpSession session,String path,Object value,String revision)throws Exception{return mvc.perform(post("/api/v1/me/developer"+path).session(session).with(csrf()).header("Origin",ORIGIN).header("If-Match","\""+revision+"\"").contentType("application/json").content(json.writeValueAsString(value)));}
    String revision(Accounts.User user){return developers.load(user.id()).revision();}
    @Test void snippetsArePrivatePersistedAndUseCompareAndSwap()throws Exception{
        var user=owner();var other=owner();var session=login(user);String before=revision(user);
        var input=Map.of("title","Useful snippet","language","typescript","prompt","typed function","code","const value = '<script>';","kind","snippet");
        mvc.perform(post("/api/v1/me/developer/snippets").session(session).header("Origin",ORIGIN).contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/me/developer/snippets").session(session).with(csrf()).header("Origin","https://foreign.example").contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/me/developer/snippets").session(session).with(csrf()).header("Origin",ORIGIN).contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isPreconditionRequired());
        var saved=postData(session,"/snippets",input,before).andExpect(status().isOk()).andExpect(jsonPath("$.snippets[0].code").value(input.get("code"))).andReturn();
        String id=json.readTree(saved.getResponse().getContentAsString()).path("snippets").get(0).path("id").asText();
        postData(session,"/snippets",input,before).andExpect(status().isConflict());
        mvc.perform(get("/api/v1/me/developer").session(login(other))).andExpect(jsonPath("$.snippets").isEmpty());
        mvc.perform(delete("/api/v1/me/developer/snippets/"+id).session(login(other)).with(csrf()).header("Origin",ORIGIN).header("If-Match","\""+revision(other)+"\"")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/me/developer").session(login(user))).andExpect(jsonPath("$.snippets[0].title").value("Useful snippet"));
        mvc.perform(delete("/api/v1/me/developer/snippets/"+id).session(session).with(csrf()).header("Origin",ORIGIN).header("If-Match","\""+revision(user)+"\"")).andExpect(status().isOk()).andExpect(jsonPath("$.snippets").isEmpty());
    }
    @Test void generationUsesOnlyExplicitInstructionsAndNeverAutomaticallySavesOrExecutes()throws Exception{
        var user=owner();var session=login(user);when(model.generateCode("java","Write a typed greeting")).thenReturn(new AiModelGateway.Reply("```java\nString greeting = \"Hello\";\n```",3,4,false));
        postData(session,"/generate",Map.of("language","java","instructions","Write a typed greeting","kind","snippet"),revision(user)).andExpect(status().isOk()).andExpect(jsonPath("$.code").value("String greeting = \"Hello\";")).andExpect(jsonPath("$.data.snippets").isEmpty());
        verify(model).generateCode("java","Write a typed greeting");verifyNoInteractions(github,cloner);
        postData(session,"/generate",Map.of("language","sql","instructions","SELECT 1","kind","sql"),revision(user)).andExpect(status().isUnprocessableEntity());
        postData(session,"/generate",Map.of("language","invalid","instructions","Anything","kind","snippet"),revision(user)).andExpect(status().isUnprocessableEntity());
    }
    @Test void connectionPasswordsAreEncryptedScopedAndNeverReturned()throws Exception{
        var user=owner();var session=login(user);
        var input=new DeveloperController.ConnectionInput(null,"Local DB","127.0.0.1",5432,"forgeflow_test","test","disable","test-only-db-secret");
        String response=postData(session,"/connections",input,revision(user)).andExpect(status().isOk()).andExpect(jsonPath("$.connections[0].hasPassword").value(true)).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("test-only-db-secret","\"password\"","githubToken");
        var db=developers.load(user.id()).connections().getFirst();assertThat(db.password()).doesNotContain("test-only-db-secret");assertThat(vault.decrypt(user.id()+":db:"+db.id(),db.password())).isEqualTo("test-only-db-secret");
        var edit=new DeveloperController.ConnectionInput(db.id(),"Renamed DB",db.host(),db.port(),db.database(),db.username(),db.sslMode(),"");postData(session,"/connections",edit,revision(user)).andExpect(status().isOk());assertThat(developers.load(user.id()).connections().getFirst().password()).isEqualTo(db.password());
        var denied=new DeveloperController.ConnectionInput(null,"Private host","169.254.169.254",5432,"forgeflow_test","test","disable","test-only");postData(session,"/connections",denied,revision(user)).andExpect(status().isForbidden());
    }
    @Test void generationAndCredentialConnectionRejectSessionsRevokedDuringProviderWork()throws Exception{
        var user=owner();var session=login(user);
        when(model.generateCode("java","Wait for revocation")).thenAnswer(invocation->{accounts.replace(new Accounts.User(user.id(),user.email(),user.name(),user.passwordHash(),false,true,user.sessionVersion()+1),user.sessionVersion());return new AiModelGateway.Reply("private source",1,1,false);});
        postData(session,"/generate",Map.of("language","java","instructions","Wait for revocation","kind","snippet"),revision(user)).andExpect(status().isUnauthorized());assertThat(developers.load(user.id()).snippets()).isEmpty();
        var second=owner();var secondSession=login(second);String token="test_only_revoked_token";
        when(github.identity(token)).thenAnswer(invocation->{accounts.replace(new Accounts.User(second.id(),second.email(),second.name(),second.passwordHash(),false,true,second.sessionVersion()+1),second.sessionVersion());return "test-owner";});
        postData(secondSession,"/github",Map.of("token",token),revision(second)).andExpect(status().isUnauthorized());assertThat(developers.load(second.id()).githubToken()).isEmpty();
    }
    @Test void githubCredentialsAndCloneRequestsArePrivateRevisionBoundAndExplicit()throws Exception{
        var user=owner();var session=login(user);String token="test_only_github_token";
        var repo=new GitHubClient.Repository(123,"test-owner/test-repository",true,"Private test",1,"https://github.com/test-owner/test-repository");
        when(github.identity(token)).thenReturn("test-owner");when(github.repositories(token,2)).thenReturn(new GitHubClient.Page(List.of(repo),true,2));when(github.repository(token,123)).thenReturn(repo);when(cloner.clone(user.id(),repo,token)).thenReturn("/private/test/123");
        String connected=postData(session,"/github",Map.of("token",token),revision(user)).andExpect(status().isOk()).andExpect(jsonPath("$.githubLogin").value("test-owner")).andReturn().getResponse().getContentAsString();assertThat(connected).doesNotContain(token);assertThat(developers.load(user.id()).githubToken()).doesNotContain(token);
        mvc.perform(get("/api/v1/me/developer/github/repositories?page=2").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.hasMore").value(true)).andExpect(jsonPath("$.page").value(2));verifyNoInteractions(cloner);
        postData(session,"/github/repositories/123/clone",Map.of(),"stale").andExpect(status().isConflict());verifyNoInteractions(cloner);
        postData(session,"/github/repositories/123/clone",Map.of(),revision(user)).andExpect(status().isOk()).andExpect(jsonPath("$.clones[0].path").value("/private/test/123"));verify(cloner).clone(user.id(),repo,token);
        postData(session,"/github/repositories/123/clone",Map.of(),revision(user)).andExpect(status().isConflict());verifyNoMoreInteractions(cloner);
        mvc.perform(delete("/api/v1/me/developer/github").session(session).with(csrf()).header("Origin",ORIGIN).header("If-Match","\""+revision(user)+"\"")).andExpect(status().isOk()).andExpect(jsonPath("$.githubConnected").value(false)).andExpect(jsonPath("$.clones[0].status").value("ready"));assertThat(developers.load(user.id()).githubToken()).isEmpty();
        mvc.perform(get("/api/v1/me/developer").session(login(owner()))).andExpect(jsonPath("$.clones").isEmpty()).andExpect(jsonPath("$.githubConnected").value(false));
    }
    @Test void publicTrialRequiresCsrfOriginExpiresAfterSixHoursAndCannotCreateExternalAccess()throws Exception{
        String email=UUID.randomUUID()+"@example.test",body=json.writeValueAsString(Map.of("email",email,"password",PASSWORD));
        mvc.perform(post("/api/v1/auth/trial").header("Origin",ORIGIN).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/trial").with(csrf()).header("Origin","https://foreign.example").contentType("application/json").content(body)).andExpect(status().isForbidden());
        var start=Instant.now();var result=mvc.perform(post("/api/v1/auth/trial").with(csrf()).header("Origin",ORIGIN).contentType("application/json").content(body)).andExpect(status().isOk()).andExpect(jsonPath("$.user.administrator").value(false)).andReturn();
        var user=accounts.findByEmail(email).orElseThrow();assertThat(user.expiresAt()).isBetween(start.plus(Duration.ofHours(6)),Instant.now().plus(Duration.ofHours(6)));assertThat(user.portalOnly()).isFalse();var session=(MockHttpSession)result.getRequest().getSession(false);
        mvc.perform(get("/api/v1/workspace").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.data.customers").isEmpty());
        for(String path:List.of("/api/v1/users","/api/v1/me/business/portal-accounts","/api/v1/me/developer/github/repositories"))mvc.perform(get(path).session(session)).andExpect(status().isForbidden());
        postData(session,"/connections",Map.of(),revision(user)).andExpect(status().isForbidden());
        var updated=accounts.replace(new Accounts.User(user.id(),user.email(),"Renamed",user.passwordHash(),false,true,user.sessionVersion()+1),user.sessionVersion());assertThat(updated.expiresAt()).isEqualTo(user.expiresAt());
        var usage=context.getBean(TrialUsage.class);for(int i=0;i<20;i++)usage.consume(user.id());assertThatThrownBy(()->usage.consume(user.id())).isInstanceOf(de.forgeflow.api.ApiFailure.class);
    }
    @SuppressWarnings("unchecked")
    @Test void trialCleanupRemovesPrivateDataButPreservesOtherAccounts()throws Exception{
        var other=owner();var id=UUID.randomUUID().toString();var trial=accounts.insert(new Accounts.User(id,id+"@example.test","Trial",HASH,false,true,0,false,Instant.now().plusSeconds(3600)));var session=login(trial);
        String now="2026-10-25T10:00:00Z";
        var customer=new WorkspaceDtos.Customer(1,"Trial customer","","","DE","trial@example.test","","","IT","01234",List.of(new WorkspaceDtos.CustomerContact(1,1,"Contact","","contact@example.test","")),"Private notes");
        var data=new WorkspaceDtos.Data(List.of(new WorkspaceDtos.Project(1,1,"Trial project",false,"2026-12-31")),List.of(customer),List.of(new WorkspaceDtos.Task(1,1,1L,"T-1","Task","","todo","medium",now,now)),List.of(new WorkspaceDtos.Activity(1,1,"task_created","Created",now)),List.of(new WorkspaceDtos.Epic(1,1,"Epic","",now,now)),List.of(new WorkspaceDtos.Sprint(1,1,"Sprint","","2026-10-25","2026-10-30","planned",List.of(1L),now,now,null,null)),List.of(new WorkspaceDtos.FileMetadata(1,1,"test.txt",1,"text/plain",0,now,now)),new WorkspaceDtos.Wiki(List.of(new WorkspaceDtos.Article(1,"Parent","Parent",1L,now,now),new WorkspaceDtos.Article(2,"Child","Child",1L,now,now,1L)),List.of(new WorkspaceDtos.Category(1,"Category","",now,now))));
        workspace.save(id,workspace.load(id).revision(),data,Map.of(1L,new WorkspaceStorage.Attachment(new byte[]{1})));workspace.saveSettings(id,new WorkspaceDtos.Settings(1,new WorkspaceDtos.SettingsValues("dark","dashboard","medium","en")));
        var conversationStore=context.getBean(ConversationStore.class);var conversation=conversationStore.create(id,"en");var pending=conversationStore.begin(id,conversation.id(),new AgentDtos.SendMessage(UUID.randomUUID(),"Private question"));conversationStore.complete(pending,new AiModelGateway.Reply("Private answer",1,1,false));
        var times=context.getBean(de.forgeflow.time.TimeTrackingStorage.class);times.save(id,new de.forgeflow.time.TimeTracking(1,"time-initial",List.of(new de.forgeflow.time.TimeTracking.Entry(UUID.randomUUID(),"2026-10-25",540,60,0,1L,1L,"","","Private comment",true))));
        var business=context.getBean(de.forgeflow.business.BusinessStorage.class);business.mutate(id,value->value);
        var collections=context.getBean(de.forgeflow.rest.RestCollectionsStorage.class);collections.save(id,new de.forgeflow.rest.RestCollections(1,"rest-initial",List.of()));
        developers.mutate(id,value->value.snippets(List.of(new DeveloperData.Snippet(UUID.randomUUID(),"Private","java","","private data","snippet",Instant.now().toString()))));developers.mutate(other.id(),value->value.generation());
        if(context.containsBean("jdbcTemplate"))context.getBean(org.springframework.jdbc.core.JdbcTemplate.class).update("update ff_accounts set expires_at=? where id=?",java.sql.Timestamp.from(Instant.now().minusSeconds(1)),id);
        else synchronized(accounts){var users=(Map<String,Accounts.User>)org.springframework.test.util.ReflectionTestUtils.getField(accounts,"users");users.put(id,new Accounts.User(id,trial.email(),trial.name(),HASH,false,true,0,false,Instant.now().minusSeconds(1)));}
        mvc.perform(get("/api/v1/auth/session").session(session)).andExpect(status().isUnauthorized());
        trials.cleanup();assertThat(accounts.findById(id)).isEmpty();assertThat(developers.load(id).snippets()).isEmpty();assertThat(workspace.loadSettings(id)).isNull();assertThat(accounts.findById(other.id())).isPresent();assertThat(developers.load(other.id()).trialGenerations()).isEqualTo(1);
        assertThat(times.load(id).entries()).isEmpty();assertThat(collections.load(id).collections()).isEmpty();assertThat(workspace.loadRecentActivity(id)).isEmpty();
        if(context.containsBean("jdbcTemplate"))assertThatThrownBy(()->workspace.load(id)).isInstanceOf(de.forgeflow.api.ApiFailure.class);else assertThat(workspace.load(id).data().customers()).isEmpty();
        assertThatThrownBy(()->developers.mutate(id,value->value.generation())).isInstanceOf(de.forgeflow.api.ApiFailure.class);
        if(context.containsBean("jdbcTemplate")){var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);for(String table:List.of("ff_accounts","ff_workspaces","ff_settings","ff_developer_data","ff_customers","ff_projects","ff_customer_contacts","ff_tasks","ff_activities","ff_epics","ff_sprints","ff_files","ff_wiki_articles","ff_wiki_categories","ff_recent_activity","ff_ai_conversations","ff_ai_executions","ff_business","ff_time_tracking","ff_rest_collections"))assertThat(jdbc.queryForObject("select count(*) from "+table+" where "+(table.equals("ff_accounts")?"id":"owner_id")+"=?",Integer.class,id)).isZero();}
    }
}
