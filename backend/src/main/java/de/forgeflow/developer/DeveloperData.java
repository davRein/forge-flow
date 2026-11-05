package de.forgeflow.developer;

import java.util.*;

public record DeveloperData(String revision, List<Snippet> snippets, List<Database> connections, String githubToken, String githubLogin, List<Clone> clones, int trialGenerations) {
    public DeveloperData { snippets=List.copyOf(snippets);connections=List.copyOf(connections);clones=List.copyOf(clones); }
    public record Snippet(UUID id, String title, String language, String prompt, String code, String kind, String updatedAt) { @Override public String toString() { return "Snippet[content=REDACTED]"; } }
    public record Database(UUID id, String name, String host, int port, String database, String username, String sslMode, String password) { @Override public String toString() { return "Database[credentials=REDACTED]"; } }
    public record Clone(long repositoryId, String name, String status, String path, String at) {}
    public static DeveloperData empty() { return new DeveloperData("developer-initial",List.of(),List.of(),"","",List.of(),0); }
    public DeveloperData revision(String value) { return new DeveloperData(value,snippets,connections,githubToken,githubLogin,clones,trialGenerations); }
    public DeveloperData snippets(List<Snippet> value) { return new DeveloperData(revision,value,connections,githubToken,githubLogin,clones,trialGenerations); }
    public DeveloperData connections(List<Database> value) { return new DeveloperData(revision,snippets,value,githubToken,githubLogin,clones,trialGenerations); }
    public DeveloperData github(String token, String login) { return new DeveloperData(revision,snippets,connections,token,login,clones,trialGenerations); }
    public DeveloperData clones(List<Clone> value) { return new DeveloperData(revision,snippets,connections,githubToken,githubLogin,value,trialGenerations); }
    public DeveloperData generation() { return new DeveloperData(revision,snippets,connections,githubToken,githubLogin,clones,trialGenerations+1); }
    @Override public String toString() { return "DeveloperData[content=REDACTED]"; }
}
