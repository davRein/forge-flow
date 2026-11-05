package de.forgeflow.developer;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import javax.crypto.*;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import de.forgeflow.api.ApiFailure;

@Component public class CredentialVault {
    private final SecretKeySpec key; private final SecureRandom random=new SecureRandom();
    public CredentialVault(@Value("${forgeflow.integrations.secret-key:}") String encoded) {
        if (encoded.isBlank()) { key=null; return; }
        try { byte[] bytes=Base64.getDecoder().decode(encoded); if(bytes.length!=32) throw new IllegalArgumentException(); key=new SecretKeySpec(bytes,"AES"); }
        catch(IllegalArgumentException error) { throw new IllegalArgumentException("INTEGRATION_SECRET_KEY muss ein Base64-kodierter 32-Byte-Schlüssel sein."); }
    }
    public boolean ready() { return key!=null; }
    public String encrypt(String scope,String value) {
        require();
        try { byte[] iv=new byte[12]; random.nextBytes(iv); var cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE,key,new GCMParameterSpec(128,iv)); cipher.updateAAD(scope.getBytes(StandardCharsets.UTF_8)); return Base64.getEncoder().encodeToString(iv)+"."+Base64.getEncoder().encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8))); }
        catch(java.security.GeneralSecurityException error) { throw failure(); }
    }
    public String decrypt(String scope,String value) {
        require();
        try { var parts=value.split("\\."); if(parts.length!=2) throw new IllegalArgumentException(); byte[] iv=Base64.getDecoder().decode(parts[0]); if(iv.length!=12) throw new IllegalArgumentException(); var cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,iv)); cipher.updateAAD(scope.getBytes(StandardCharsets.UTF_8)); return new String(cipher.doFinal(Base64.getDecoder().decode(parts[1])),StandardCharsets.UTF_8); }
        catch(java.security.GeneralSecurityException|IllegalArgumentException error) { throw failure(); }
    }
    private void require() { if(key==null) throw new ApiFailure(503,"INTEGRATIONS_NOT_CONFIGURED","Für externe Zugänge muss die Administration INTEGRATION_SECRET_KEY konfigurieren."); }
    private ApiFailure failure() { return new ApiFailure(503,"CREDENTIAL_UNAVAILABLE","Gespeicherte Zugangsdaten konnten nicht entschlüsselt werden. Bitte Server-Schlüssel prüfen."); }
}
