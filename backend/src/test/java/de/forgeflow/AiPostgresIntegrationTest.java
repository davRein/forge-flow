package de.forgeflow;

import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Reuses the complete cookie/CSRF/origin/ownership/actions/SSE HTTP contract with JPA storage. */
@ActiveProfiles(value="postgres", inheritProfiles=false)
class AiPostgresIntegrationTest extends AiIntegrationTest {
    @Override protected String storageName() { return "postgresql"; }
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) { AiTestDatabase.configure(registry, "ai-http-"); }
}
