package de.forgeflow.auth;

import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import de.forgeflow.api.ApiFailure;

@Component
public class AttemptLimiter {
    private record Attempt(int count, long expires) {}
    private final Map<String, Attempt> attempts = new HashMap<>();
    public synchronized void check(String key, int maximum) {
        long now = System.currentTimeMillis();
        attempts.entrySet().removeIf(entry -> entry.getValue().expires() <= now);
        Attempt previous = attempts.getOrDefault(key, new Attempt(0, now + 900000));
        if (attempts.size() >= 10000 && !attempts.containsKey(key))
            throw new ApiFailure(429, "RATE_LIMITED", "Zu viele Versuche. Bitte später erneut versuchen.");
        Attempt next = new Attempt(previous.count() + 1, previous.expires());
        attempts.put(key, next);
        if (next.count() > maximum)
            throw new ApiFailure(429, "RATE_LIMITED", "Zu viele Versuche. Bitte später erneut versuchen.");
    }
}
