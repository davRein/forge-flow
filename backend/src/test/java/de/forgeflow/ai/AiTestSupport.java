package de.forgeflow.ai;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import de.forgeflow.api.ApiFailure;
import static org.assertj.core.api.Assertions.*;

final class AiTestSupport {
    static ProjectTools tools(de.forgeflow.auth.Accounts accounts) {
        return new ProjectTools(accounts, org.mockito.Mockito.mock(de.forgeflow.workspace.WorkspaceStorage.class),
            tools.jackson.databind.json.JsonMapper.builder().build(), new TestClock());
    }
    static AiProperties properties() { return properties(20, 2, 2, 4, 3, 4000); }
    static AiProperties properties(int requests, int concurrent, int perUser, int total, int turns, int characters) {
        return new AiProperties(true, "test-only-key", "test-only-model", Duration.ofSeconds(1), "completion",
            256, requests, concurrent, perUser, total, turns, characters, Duration.ofMinutes(1));
    }
    static void failure(Runnable action, int status, String code) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiFailure.class, error -> {
            assertThat(error.status).isEqualTo(status); assertThat(error.code).isEqualTo(code);
        });
    }
    static final class TestClock extends Clock {
        Instant now = Instant.parse("2026-10-23T10:00:00Z");
        @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
        void advance(Duration duration) { now = now.plus(duration); }
    }
}
