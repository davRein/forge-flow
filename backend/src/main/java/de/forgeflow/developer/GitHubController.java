package de.forgeflow.developer;

import java.time.Instant;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.auth.*;
import de.forgeflow.api.ApiFailure;

@RestController @RequestMapping("/api/v1/me/developer/github") public class GitHubController {
    public record Token(@NotBlank @Pattern(regexp="[A-Za-z0-9_.-]{10,512}")String token){@Override public String toString(){return "Token[REDACTED]";}}
    private final DeveloperStorage storage;private final CredentialVault vault;private final Accounts accounts;private final GitHubClient github;private final NativeGitCloner cloner;private final DeveloperController views;private final AttemptLimiter limits;
    public GitHubController(DeveloperStorage storage,CredentialVault vault,Accounts accounts,GitHubClient github,NativeGitCloner cloner,DeveloperController views,AttemptLimiter limits){this.storage=storage;this.vault=vault;this.accounts=accounts;this.github=github;this.cloner=cloner;this.views=views;this.limits=limits;}
    private Accounts.User user(Authentication auth){return accounts.findById(auth.getName()).filter(value->value.active()&&!value.portalOnly()&&value.expiresAt()==null).orElseThrow(()->new ApiFailure(403,"FORBIDDEN","Für GitHub ist ein reguläres Konto erforderlich."));}
    private void valid(Accounts.User user){accounts.findById(user.id()).filter(value->value.active()&&value.sessionVersion()==user.sessionVersion()).orElseThrow(()->new ApiFailure(401,"UNAUTHENTICATED","Die Sitzung ist abgelaufen."));}
    private String token(String owner){var data=storage.load(owner);if(data.githubToken().isBlank())throw new ApiFailure(422,"GITHUB_NOT_CONNECTED","Bitte zuerst GitHub verbinden.");return vault.decrypt(owner+":github",data.githubToken());}
    private void revision(DeveloperData data,String header){if(header==null)throw new ApiFailure(428,"REVISION_REQUIRED","Eine Datenversion ist erforderlich.");if(!header.equals("\""+data.revision()+"\""))throw new ApiFailure(409,"VERSION_CONFLICT","Die Entwicklerdaten wurden inzwischen geändert. Bitte neu laden.");}
    public static boolean stale(DeveloperData.Clone value){return value.status().equals("cloning")&&Instant.parse(value.at()).isBefore(Instant.now().minusSeconds(120));}
    @PostMapping public DeveloperController.View connect(Authentication auth,@RequestHeader(value="If-Match",required=false)String match,@Valid @RequestBody Token input){var user=user(auth);String owner=user.id();limits.check("github-connect:"+owner,10);revision(storage.load(owner),match);String encrypted=vault.encrypt(owner+":github",input.token()), login=github.identity(input.token());return views.view(storage.mutate(owner,before->{valid(user);revision(before,match);return before.github(encrypted,login);}));}
    @DeleteMapping public DeveloperController.View disconnect(Authentication auth,@RequestHeader(value="If-Match",required=false)String match){String owner=user(auth).id();return views.view(storage.mutate(owner,before->{revision(before,match);return before.github("","");}));}
    @GetMapping("/repositories") public GitHubClient.Page repositories(Authentication auth,@RequestParam(defaultValue="1")int page){String owner=user(auth).id();limits.check("github-list:"+owner,100);return github.repositories(token(owner),page);}
    @PostMapping("/repositories/{id}/clone") public DeveloperController.View clone(Authentication auth,@RequestHeader(value="If-Match",required=false)String match,@PathVariable long id){
        var user=user(auth);String owner=user.id();limits.check("github-clone:"+owner,10);revision(storage.load(owner),match);String token=token(owner);var repository=github.repository(token,id);
        if(repository.id()!=id)throw new ApiFailure(502,"GITHUB_INVALID_RESPONSE","Ungültige Repository-Antwort.");
        storage.mutate(owner,before->{valid(user);revision(before,match);if(before.clones().size()>=20&&before.clones().stream().noneMatch(value->value.repositoryId()==id))throw new ApiFailure(422,"GIT_REPOSITORY_LIMIT","Höchstens 20 private Klone pro Konto.");if(before.clones().stream().anyMatch(value->value.status().equals("cloning")&&!stale(value)||value.repositoryId()==id&&value.status().equals("ready")))throw new ApiFailure(409,"GIT_BUSY","Ein Klon läuft bereits oder das Repository ist schon vorhanden.");var values=new ArrayList<>(before.clones());values.removeIf(value->value.repositoryId()==id);values.add(new DeveloperData.Clone(id,repository.name(),"cloning","",Instant.now().toString()));return before.clones(values);});
        String path="";boolean success=false;
        try{path=cloner.clone(owner,repository,token);success=true;}
        finally{String savedPath=path,status=success?"ready":"failed";storage.mutate(owner,before->{var values=new ArrayList<>(before.clones());values.removeIf(value->value.repositoryId()==id);values.add(new DeveloperData.Clone(id,repository.name(),status,savedPath,Instant.now().toString()));return before.clones(values);});}
        return views.view(storage.load(owner));
    }
}
