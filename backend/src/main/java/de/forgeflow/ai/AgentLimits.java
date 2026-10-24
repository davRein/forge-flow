package de.forgeflow.ai;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicBoolean;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.auth.AttemptLimiter;

public final class AgentLimits {
    private final Set<String> activeUsers = ConcurrentHashMap.newKeySet();
    private final Semaphore permits;
    private final AttemptLimiter attempts;
    private final int requestLimit;
    public AgentLimits(AiProperties properties, AttemptLimiter attempts) {
        permits = new Semaphore(properties.maxConcurrent()); this.attempts = attempts; requestLimit = properties.requestsPer15Minutes();
    }
    public Lease acquire(String userId) {
        if (!activeUsers.add(userId)) throw busy();
        if (!permits.tryAcquire()) { activeUsers.remove(userId); throw busy(); }
        var lease = new Lease(userId);
        try { attempts.check("ai-chat:" + userId, requestLimit); return lease; }
        catch (RuntimeException error) { lease.close(); throw error; }
    }
    private static ApiFailure busy() { return new ApiFailure(429, "AI_BUSY", "Es laufen bereits KI-Anfragen. Bitte kurz warten."); }
    public final class Lease implements AutoCloseable {
        private final String userId;
        private final AtomicBoolean closed = new AtomicBoolean();
        private Lease(String userId) { this.userId = userId; }
        @Override public void close() { if (closed.compareAndSet(false, true)) { activeUsers.remove(userId); permits.release(); } }
    }
}
