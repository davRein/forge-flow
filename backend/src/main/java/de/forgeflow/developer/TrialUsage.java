package de.forgeflow.developer;
import org.springframework.stereotype.Component;
import de.forgeflow.api.ApiFailure;
@Component public class TrialUsage {
    private final DeveloperStorage storage;
    public TrialUsage(DeveloperStorage storage) { this.storage=storage; }
    public void consume(String owner) { storage.mutate(owner,before->{if(before.trialGenerations()>=20)throw new ApiFailure(429,"TRIAL_AI_LIMIT","Das KI-Kontingent dieses Testkontos ist aufgebraucht."); return before.generation();}); }
}
