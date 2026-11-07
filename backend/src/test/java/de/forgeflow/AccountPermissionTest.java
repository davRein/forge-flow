package de.forgeflow;

import de.forgeflow.auth.Accounts;
import de.forgeflow.auth.AppPermissions;
import de.forgeflow.ai.AgentDtos.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AccountPermissionTest {
    @Test void revokedAppsCannotBeReadThroughOldChatHistoriesOrLegacyRestRoutes() {
        var user=new Accounts.User("fixture", "fixture@example.test", "Fixture", "synthetic-test-only", false, true, 0, false, null, "fixture.user", List.of("requestLab"));
        var now=Instant.now();
        var rest=new Message(UUID.randomUUID(),"user","Synthetic",now,List.of(),new PageContext("/devTools/rest",null,null));
        var project=new Message(UUID.randomUUID(),"assistant","Synthetic private project",now);
        assertThat(AppPermissions.allowsHistory(user,new Conversation(UUID.randomUUID(),"en",now,now,List.of(rest)))).isTrue();
        assertThat(AppPermissions.allowsHistory(user,new Conversation(UUID.randomUUID(),"en",now,now,List.of(project,rest)))).isFalse();
        assertThat(AppPermissions.allows(user,"settings")).isTrue();
        assertThatThrownBy(()->AppPermissions.grants(List.of("wiki","wiki"))).isInstanceOf(de.forgeflow.api.ApiFailure.class);
        assertThatThrownBy(()->AppPermissions.grants(List.of("unknown"))).isInstanceOf(de.forgeflow.api.ApiFailure.class);
    }
}
