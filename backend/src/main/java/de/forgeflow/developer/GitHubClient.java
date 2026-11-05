package de.forgeflow.developer;

import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.api.ApiFailure;

@Component public class GitHubClient {
    public record Repository(long id,String name,boolean privateRepo,String description,long size,String url) {}
    public record Page(List<Repository> items,boolean hasMore,int page) {}
    private record Response(JsonNode body,String links) {}
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    private final JsonMapper json;
    private static final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {
        private final java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
        private final java.util.concurrent.CompletableFuture<byte[]> result=new java.util.concurrent.CompletableFuture<>();
        private java.util.concurrent.Flow.Subscription subscription;
        public java.util.concurrent.CompletionStage<byte[]> getBody(){return result;}
        public void onSubscribe(java.util.concurrent.Flow.Subscription value){subscription=value;value.request(1);}
        public void onNext(List<java.nio.ByteBuffer> buffers){
            for(var buffer:buffers){if(bytes.size()+buffer.remaining()>2*1024*1024){subscription.cancel();result.completeExceptionally(new java.io.IOException("Response limit"));return;}byte[] value=new byte[buffer.remaining()];buffer.get(value);bytes.writeBytes(value);}
            subscription.request(1);
        }
        public void onError(Throwable failure){result.completeExceptionally(failure);}
        public void onComplete(){result.complete(bytes.toByteArray());}
    }
    public GitHubClient(JsonMapper json){this.json=json;}
    private Response get(String path,String token){
        try {
            var request=HttpRequest.newBuilder(URI.create("https://api.github.com"+path)).timeout(Duration.ofSeconds(15)).header("Accept","application/vnd.github+json").header("Authorization","Bearer "+token).header("X-GitHub-Api-Version","2026-03-10").header("User-Agent","ForgeFlow").GET().build();
            var response=http.send(request,info->new LimitedBody());
            {
                if(response.statusCode()!=200)throw new ApiFailure(response.statusCode()==401?422:response.statusCode()==403||response.statusCode()==429?429:502,"GITHUB_UNAVAILABLE","GitHub-Anfrage fehlgeschlagen (HTTP "+response.statusCode()+"). Token, Repositoryrechte oder Kontingent prüfen.");
                byte[] bytes=response.body();
                return new Response(json.readTree(bytes),response.headers().firstValue("Link").orElse(""));
            }
        } catch(InterruptedException error){Thread.currentThread().interrupt();throw new ApiFailure(503,"GITHUB_UNAVAILABLE","GitHub-Anfrage wurde abgebrochen.");}
        catch(java.io.IOException error){throw new ApiFailure(503,"GITHUB_UNAVAILABLE","GitHub ist derzeit nicht erreichbar.");}
    }
    public String identity(String token){String login=get("/user",token).body().path("login").asText("");if(!login.matches("[A-Za-z0-9-]{1,100}"))throw new ApiFailure(502,"GITHUB_INVALID_RESPONSE","Ungültige GitHub-Antwort.");return login;}
    private Repository repository(JsonNode value){
        String name=value.path("full_name").asText(""); long id=value.path("id").asLong();
        if(id<=0||!name.matches("[A-Za-z0-9_-][A-Za-z0-9_.-]{0,100}/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,100}"))throw new ApiFailure(502,"GITHUB_INVALID_RESPONSE","Ungültige Repository-Antwort.");
        return new Repository(id,name,value.path("private").asBoolean(),value.path("description").asText("").substring(0,Math.min(1000,value.path("description").asText("").length())),value.path("size").asLong(),"https://github.com/"+name);
    }
    public Page repositories(String token,int page){if(page<1||page>200)throw DeveloperController.invalid("Ungültige Repository-Seite.");var response=get("/user/repos?per_page=50&sort=full_name&direction=asc&page="+page,token);if(!response.body().isArray())throw new ApiFailure(502,"GITHUB_INVALID_RESPONSE","Ungültige GitHub-Antwort.");var values=new ArrayList<Repository>();response.body().forEach(value->values.add(repository(value)));return new Page(values,response.links().contains("rel=\"next\""),page);}
    public Repository repository(String token,long id){if(id<=0)throw DeveloperController.invalid("Ungültiges Repository.");return repository(get("/repositories/"+id,token).body());}
}
