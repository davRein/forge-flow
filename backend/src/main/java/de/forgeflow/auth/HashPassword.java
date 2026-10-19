package de.forgeflow.auth;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public final class HashPassword {
    private HashPassword() {}
    public static void main(String[] args) {
        var console = System.console();
        if (console == null) throw new IllegalStateException("Bitte direkt in einem interaktiven Terminal starten.");
        char[] input = console.readPassword("Passwort (mindestens 12 Zeichen, maximal 72 UTF-8-Bytes): ");
        if (input == null) return;
        String password = new String(input); Arrays.fill(input, '\0');
        if (password.codePointCount(0, password.length()) < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72 || password.indexOf('\0') >= 0) throw new IllegalArgumentException("Ungültige Passwortlänge.");
        console.printf("%s%n", new BCryptPasswordEncoder(12).encode(password));
    }
}
