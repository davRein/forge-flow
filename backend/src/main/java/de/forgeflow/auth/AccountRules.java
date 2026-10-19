package de.forgeflow.auth;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import de.forgeflow.api.ApiFailure;

public final class AccountRules {
    private AccountRules() {}
    public static String email(String value) { return value.strip().toLowerCase(Locale.ROOT); }
    public static void current(Accounts.User user, long expectedVersion) {
        if (user == null || user.sessionVersion() != expectedVersion)
            throw new ApiFailure(409, "ACCOUNT_CHANGED", "Das Konto wurde inzwischen geändert. Bitte erneut anmelden.");
    }
    public static void password(String password) {
        if (password == null || password.codePointCount(0, password.length()) < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72 || password.indexOf('\0') >= 0)
            throw new ApiFailure(400, "INVALID_PASSWORD", "Das Passwort muss mindestens 12 Zeichen und höchstens 72 UTF-8-Bytes enthalten.");
    }
}
