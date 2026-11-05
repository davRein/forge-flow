package de.forgeflow.developer;

import java.nio.file.*;
import java.nio.file.attribute.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import de.forgeflow.api.ApiFailure;

@Component public class NativeGitCloner {
    private final Path root; private final Semaphore permits=new Semaphore(2);
    public NativeGitCloner(@Value("${forgeflow.developer.git-root:./data/git}") String root){this.root=Path.of(root).toAbsolutePath().normalize();}
    private void privateDirectory(Path path)throws java.io.IOException{Files.createDirectories(path);if(Files.isSymbolicLink(path))throw new java.io.IOException();if(Files.getFileStore(path).supportsFileAttributeView("posix"))Files.setPosixFilePermissions(path,PosixFilePermissions.fromString("rwx------"));}
    private String ownerKey(String owner){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(owner.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException error){throw new IllegalStateException(error);}}
    public String clone(String owner,GitHubClient.Repository repository,String token){
        if(!repository.name().matches("[A-Za-z0-9_-][A-Za-z0-9_.-]{0,100}/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,100}")||repository.id()<=0||repository.size()>102400)throw new ApiFailure(422,"GIT_REPOSITORY_LIMIT","Ungültiges Repository oder größer als 100 MiB.");
        if(!permits.tryAcquire())throw new ApiFailure(429,"GIT_BUSY","Es laufen bereits Git-Vorgänge. Bitte kurz warten.");
        Path staging=null,home=null; Process process=null;
        try{
            privateDirectory(root);Path base=root.toRealPath();home=base.resolve(ownerKey(owner));privateDirectory(home);if(!home.toRealPath().getParent().equals(base))throw new java.io.IOException();
            Path destination=home.resolve(Long.toString(repository.id()));if(Files.exists(destination,LinkOption.NOFOLLOW_LINKS))throw new ApiFailure(409,"GIT_ALREADY_CLONED","Dieses Repository wurde bereits geklont.");
            if(Files.getFileStore(home).getUsableSpace()<512L*1024*1024)throw new ApiFailure(507,"GIT_DISK_FULL","Zu wenig freier Speicher für das Repository.");
            staging=Files.createTempDirectory(home,"clone-"+repository.id()+"-");
            var builder=new ProcessBuilder("git","-c","credential.helper=","-c","core.hooksPath="+(System.getProperty("os.name").startsWith("Windows")?"NUL":"/dev/null"),"-c","init.templateDir=","clone","--depth=1","--no-recurse-submodules","--no-local","--","https://github.com/"+repository.name()+".git",staging.toString());
            var environment=builder.environment();environment.keySet().removeIf(key->key.startsWith("GIT_")||key.startsWith("GCM_")||key.equals("SSH_ASKPASS"));
            environment.put("GIT_TERMINAL_PROMPT","0");environment.put("GCM_INTERACTIVE","never");environment.put("GIT_ALLOW_PROTOCOL","https");environment.put("GIT_CONFIG_NOSYSTEM","1");environment.put("GIT_CONFIG_GLOBAL",System.getProperty("os.name").startsWith("Windows")?"NUL":"/dev/null");
            environment.put("GIT_CONFIG_COUNT","3");environment.put("GIT_CONFIG_KEY_0","http.https://github.com/.extraheader");environment.put("GIT_CONFIG_VALUE_0","Authorization: Basic "+Base64.getEncoder().encodeToString(("x-access-token:"+token).getBytes(StandardCharsets.UTF_8)));environment.put("GIT_CONFIG_KEY_1","http.followRedirects");environment.put("GIT_CONFIG_VALUE_1","false");environment.put("GIT_CONFIG_KEY_2","protocol.file.allow");environment.put("GIT_CONFIG_VALUE_2","never");
            builder.redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD);process=builder.start();
            if(!process.waitFor(45,TimeUnit.SECONDS)){stop(process);throw new ApiFailure(504,"GIT_TIMEOUT","Das Klonen hat das Zeitlimit überschritten.");}
            if(process.exitValue()!=0)throw new ApiFailure(422,"GIT_CLONE_FAILED","Klonen fehlgeschlagen. Git-Installation, Tokenrechte und Speicherplatz prüfen.");
            try{Files.move(staging,destination,StandardCopyOption.ATOMIC_MOVE);}catch(AtomicMoveNotSupportedException error){Files.move(staging,destination);}
            staging=null;return destination.toString();
        }catch(InterruptedException error){Thread.currentThread().interrupt();throw new ApiFailure(503,"GIT_CANCELLED","Git-Vorgang abgebrochen.");}
        catch(java.io.IOException error){throw new ApiFailure(503,"GIT_UNAVAILABLE","Git oder das private Repository-Verzeichnis ist nicht verfügbar.");}
        finally{
            if(process!=null&&process.isAlive())stop(process);
            if(staging!=null&&home!=null&&staging.normalize().getParent().equals(home)&&staging.getFileName().toString().startsWith("clone-")){
                try{Files.walkFileTree(staging,new SimpleFileVisitor<Path>(){public FileVisitResult visitFile(Path file,BasicFileAttributes attrs)throws java.io.IOException{Files.delete(file);return FileVisitResult.CONTINUE;}public FileVisitResult postVisitDirectory(Path dir,java.io.IOException error)throws java.io.IOException{Files.delete(dir);return FileVisitResult.CONTINUE;}});}catch(java.io.IOException ignored){}
            }
            permits.release();
        }
    }
    private void stop(Process process){process.descendants().forEach(ProcessHandle::destroyForcibly);process.destroyForcibly();try{process.waitFor(5,TimeUnit.SECONDS);}catch(InterruptedException ignored){Thread.currentThread().interrupt();}}
}
