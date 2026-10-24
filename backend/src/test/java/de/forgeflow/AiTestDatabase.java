package de.forgeflow;

import java.util.UUID;
import org.springframework.test.context.DynamicPropertyRegistry;

/** Never accepts a production database name. Normal tests use isolated H2 databases. */
final class AiTestDatabase {
    static void configure(DynamicPropertyRegistry registry, String name) {
        String value = System.getenv("TEST_POSTGRES_URL");
        boolean postgres = value != null && !value.isBlank();
        if (postgres) {
            if (!value.startsWith("jdbc:postgresql://")) throw new IllegalArgumentException("A dedicated PostgreSQL test database is required.");
            var uri = java.net.URI.create(value.substring(5));
            if (uri.getRawQuery() != null || uri.getUserInfo() != null || uri.getPath() == null || !uri.getPath().matches("/[a-z][a-z0-9_]*_test"))
                throw new IllegalArgumentException("Database must end in _test, without credentials or URL parameters.");
        }
        String url = postgres ? value : "jdbc:h2:mem:" + name + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000";
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> postgres ? System.getenv().getOrDefault("TEST_POSTGRES_USER", "forgeflow_test") : "sa");
        registry.add("spring.datasource.password", () -> postgres ? System.getenv().getOrDefault("TEST_POSTGRES_PASSWORD", "") : "");
        registry.add("spring.flyway.locations", () -> "classpath:db/migration/common" + (postgres ? ",classpath:db/migration/postgresql" : ""));
        if (postgres) {
            String schema = name.replace('-', '_') + UUID.randomUUID().toString().replace("-", "");
            registry.add("spring.datasource.hikari.schema", () -> schema);
            registry.add("spring.flyway.schemas", () -> schema);
            registry.add("spring.flyway.default-schema", () -> schema);
            registry.add("spring.jpa.properties.hibernate.default_schema", () -> schema);
        }
    }
}
