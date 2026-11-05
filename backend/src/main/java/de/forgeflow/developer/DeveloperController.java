package de.forgeflow.developer;

import java.time.Instant;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.ai.*;
import de.forgeflow.auth.*;
import de.forgeflow.api.ApiFailure;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.developer.DeveloperData.*;

@RestController @RequestMapping("/api/v1/me/developer") public class DeveloperController {
    public static final Set<String> LANGUAGES=Set.of("typescript","javascript","java","python","sql","html","css","json","bash","csharp","go","rust","php","plaintext");
    public record ConnectionInfo(UUID id,String name,String host,int port,String database,String username,String sslMode,boolean hasPassword) {}
    public record View(String revision,List<Snippet> snippets,List<ConnectionInfo> connections,boolean githubConnected,String githubLogin,List<Clone> clones,boolean integrationsConfigured) {}
    public record SnippetInput(UUID id,@NotBlank @Size(max=200) String title,@NotBlank String language,@NotNull @Size(max=8000) String prompt,@NotNull @Size(max=200000) String code,@Pattern(regexp="snippet|sql") @NotNull String kind) { @Override public String toString(){return "SnippetInput[content=REDACTED]";} }
    public record ConnectionInput(UUID id,@NotBlank @Size(max=200) String name,@NotBlank @Size(max=253) String host,@Min(1) @Max(65535) int port,@NotBlank @Pattern(regexp="[A-Za-z0-9_][A-Za-z0-9_.-]{0,62}") String database,@NotBlank @Size(max=128) String username,@NotNull @Pattern(regexp="disable|require|verify-full") String sslMode,@Size(max=1024) String password) { @Override public String toString(){return "ConnectionInput[credentials=REDACTED]";} }
    public record Generate(@NotBlank String language,@NotBlank @Size(max=8000) String instructions,@NotNull @Pattern(regexp="snippet|sql") String kind,UUID connectionId) { @Override public String toString(){return "Generate[content=REDACTED]";} }
    public record SqlInput(@NotBlank @Size(max=100000) String sql,@NotNull Boolean readOnly) { @Override public String toString(){return "SqlInput[content=REDACTED]";} }
    public record Execute(@NotNull UUID ticket) {}
    private final DeveloperStorage storage; private final CredentialVault vault; private final Accounts accounts; private final DatabaseRunner database; private final JsonMapper json; private final AttemptLimiter attempts; private final ObjectProvider<AiModelGateway> models; private final ObjectProvider<AgentLimits> limits; private final TrialUsage trials;
    public DeveloperController(DeveloperStorage storage,CredentialVault vault,Accounts accounts,DatabaseRunner database,JsonMapper json,AttemptLimiter attempts,ObjectProvider<AiModelGateway> models,ObjectProvider<AgentLimits> limits,TrialUsage trials) { this.storage=storage;this.vault=vault;this.accounts=accounts;this.database=database;this.json=json;this.attempts=attempts;this.models=models;this.limits=limits;this.trials=trials; }
    public static ApiFailure invalid(String message){return new ApiFailure(422,"INVALID_DEVELOPER_DATA",message);}
    private Accounts.User user(Authentication auth) { return accounts.findById(auth.getName()).filter(value->value.active()&&!value.portalOnly()).orElseThrow(()->new ApiFailure(401,"UNAUTHENTICATED","Bitte anmelden.")); }
    public View view(DeveloperData data) { return new View(data.revision(),data.snippets(),data.connections().stream().map(value->new ConnectionInfo(value.id(),value.name(),value.host(),value.port(),value.database(),value.username(),value.sslMode(),!value.password().isBlank())).toList(),!data.githubToken().isBlank(),data.githubLogin(),data.clones().stream().map(value->GitHubController.stale(value)?new Clone(value.repositoryId(),value.name(),"failed",value.path(),value.at()):value).toList(),vault.ready()); }
    private View mutate(String owner,String header,java.util.function.UnaryOperator<DeveloperData> operation) {
        if(header==null)throw new ApiFailure(428,"REVISION_REQUIRED","Eine Datenversion ist erforderlich.");
        return view(storage.mutate(owner,before->{if(!header.equals("\""+before.revision()+"\""))throw new ApiFailure(409,"VERSION_CONFLICT","Die Entwicklerdaten wurden inzwischen geändert. Bitte neu laden."); var next=operation.apply(before); if(json.writeValueAsString(next).getBytes(java.nio.charset.StandardCharsets.UTF_8).length>10*1024*1024)throw new ApiFailure(413,"DEVELOPER_LIMIT","Entwicklerdaten dürfen höchstens 10 MiB umfassen."); return next;}));
    }
    @GetMapping public ResponseEntity<View> get(Authentication auth){var value=view(storage.load(user(auth).id()));return ResponseEntity.ok().eTag(value.revision()).body(value);}
    @PostMapping("/snippets") public View saveSnippet(Authentication auth,@RequestHeader(value="If-Match",required=false)String match,@Valid @RequestBody SnippetInput input){
        String owner=user(auth).id(); if(!LANGUAGES.contains(input.language())||input.kind().equals("sql")&&!input.language().equals("sql"))throw invalid("Ungültige Programmiersprache.");
        return mutate(owner,match,before->{var values=new ArrayList<>(before.snippets()); UUID id=input.id()==null?UUID.randomUUID():input.id(); if(input.id()!=null&&values.stream().noneMatch(value->value.id().equals(id)))throw new ApiFailure(404,"SNIPPET_NOT_FOUND","Snippet nicht gefunden."); values.removeIf(value->value.id().equals(id)); if(values.size()>=500)throw invalid("Höchstens 500 Snippets pro Konto."); values.add(new Snippet(id,input.title().strip(),input.language(),input.prompt(),input.code(),input.kind(),Instant.now().toString())); return before.snippets(values);});
    }
    @DeleteMapping("/snippets/{id}") public View deleteSnippet(Authentication auth,@RequestHeader(value="If-Match",required=false)String match,@PathVariable UUID id){return mutate(user(auth).id(),match,before->{if(before.snippets().stream().noneMatch(value->value.id().equals(id)))throw new ApiFailure(404,"SNIPPET_NOT_FOUND","Snippet nicht gefunden.");return before.snippets(before.snippets().stream().filter(value->!value.id().equals(id)).toList());});}
    private Accounts.User external(Authentication auth){var user=user(auth);if(user.expiresAt()!=null)throw new ApiFailure(403,"TRIAL_RESTRICTED","Testkonten dürfen keine externen Zugänge verwenden.");return user;}
    @PostMapping("/connections") public View connection(Authentication auth,@RequestHeader(value="If-Match",required=false)String match,@Valid @RequestBody ConnectionInput input){
        String owner=external(auth).id(),host=input.host().strip().toLowerCase(Locale.ROOT);
        if(!database.permitted(host))throw new ApiFailure(403,"DB_HOST_NOT_ALLOWED","Die Administration muss diesen Datenbankhost in DEV_DB_HOSTS freigeben.");
        if(!host.matches("[a-z0-9:.-]{1,253}"))throw invalid("Ungültiger Datenbankhost.");
        return mutate(owner,match,before->{var values=new ArrayList<>(before.connections()); var previous=input.id()==null?null:values.stream().filter(value->value.id().equals(input.id())).findFirst().orElseThrow(()->new ApiFailure(404,"CONNECTION_NOT_FOUND","Datenbankverbindung nicht gefunden.")); UUID id=previous==null?UUID.randomUUID():previous.id(); String secret=input.password()==null||input.password().isEmpty()?previous==null?vault.encrypt(owner+":db:"+id,""):previous.password():vault.encrypt(owner+":db:"+id,input.password()); values.removeIf(value->value.id().equals(id)); if(values.size()>=20)throw invalid("Höchstens 20 Datenbankverbindungen pro Konto."); values.add(new Database(id,input.name().strip(),host,input.port(),input.database(),input.username(),input.sslMode(),secret));return before.connections(values);});
    }
    @DeleteMapping("/connections/{id}")public View deleteConnection(Authentication auth,@RequestHeader(value="If-Match",required=false)String match,@PathVariable UUID id){return mutate(external(auth).id(),match,before->before.connections(before.connections().stream().filter(value->!value.id().equals(id)).toList()));}
    @PostMapping("/connections/{id}/test")public Map<String,String> test(Authentication auth,@PathVariable UUID id){String owner=external(auth).id(); attempts.check("db-test:"+owner,20);database.test(owner,id);return Map.of("status","ok");}
    @PostMapping("/connections/{id}/prepare")public DatabaseRunner.Prepared prepare(Authentication auth,@PathVariable UUID id,@Valid @RequestBody SqlInput input){var user=external(auth);attempts.check("db-prepare:"+user.id(),30);return database.prepare(user,id,input.sql(),input.readOnly());}
    @PostMapping("/connections/execute")public List<DatabaseRunner.Result> execute(Authentication auth,@Valid @RequestBody Execute input){return database.execute(external(auth),input.ticket());}
    @PostMapping("/generate") public Map<String,Object> generate(Authentication auth,@Valid @RequestBody Generate input){
        var user=user(auth);if(!LANGUAGES.contains(input.language()))throw invalid("Ungültige Programmiersprache.");
        if(input.kind().equals("sql")){external(auth);if(input.connectionId()==null)throw invalid("Bitte eine Datenbankverbindung auswählen.");database.find(user.id(),input.connectionId());if(!input.language().equals("sql"))throw invalid("Ungültige Programmiersprache.");}
        var model=models.getIfAvailable();var limiter=limits.getIfAvailable();if(model==null||limiter==null)throw new ApiFailure(503,"AI_DISABLED","Die KI ist auf diesem Server nicht aktiviert.");
        try(var lease=limiter.acquire(user.id())){
            if(user.expiresAt()!=null)trials.consume(user.id());
            var result=model.generateCode(input.kind().equals("sql")?"PostgreSQL SQL":input.language(),input.instructions());
            if(result==null||result.text()==null||result.text().isBlank()||result.text().length()>200000)throw new ApiFailure(502,"AI_INVALID_RESPONSE","Die KI hat keinen gültigen Code geliefert.");
            accounts.findById(user.id()).filter(current->current.active()&&current.sessionVersion()==user.sessionVersion()).orElseThrow(()->new ApiFailure(401,"UNAUTHENTICATED","Die Sitzung ist abgelaufen."));
            String code=result.text().replaceFirst("(?s)^```[^\\n]*\\n","").replaceFirst("\\n```\\s*$","");
            return Map.of("code",code,"truncated",result.truncated(),"data",view(storage.load(user.id())));
        }
    }
}
