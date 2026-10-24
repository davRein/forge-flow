package de.forgeflow.ai;

import java.util.function.BooleanSupplier;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.auth.Accounts;

public record AgentExecutionContext(String userId, long sessionVersion, BooleanSupplier sessionActive) {
    public void verify(Accounts accounts) {
        if (!sessionActive.getAsBoolean() || accounts.findById(userId)
                .filter(user -> user.active() && user.sessionVersion() == sessionVersion).isEmpty())
            throw new ApiFailure(401, "UNAUTHENTICATED", "Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.");
    }
}
