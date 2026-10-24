package de.forgeflow.ai;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.ai.openai.OpenAiChatModel;
import static org.assertj.core.api.Assertions.*;

@Tag("openai-live")
@EnabledIfSystemProperty(named="forgeflow.ai.live-test", matches="true")
class OpenAiLiveTest {
    @Test void explicitlyEnabledProviderSmokeTest() {
        String key = System.getenv("OPENAI_API_KEY"); String model = System.getenv("AI_MODEL");
        if (key == null || key.isBlank() || model == null || model.isBlank())
            throw new IllegalStateException("The opt-in live test requires OPENAI_API_KEY and AI_MODEL.");
        var properties = new AiProperties(true, key, model, Duration.ofSeconds(20),
            System.getenv().getOrDefault("AI_OUTPUT_TOKEN_MODE", "completion"), 256, 1, 1, 1, 1, 1, 4000, Duration.ofMinutes(1));
        var gateway = new OpenAiModelGateway(OpenAiChatModel.builder().options(AiConfiguration.options(properties)).build());
        var reply = gateway.reply("en", List.of(), "Reply with a short greeting.");
        assertThat(reply.text()).isNotBlank();
    }
}
