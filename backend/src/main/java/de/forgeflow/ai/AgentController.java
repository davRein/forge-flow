package de.forgeflow.ai;

import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.ai.AgentDtos.*;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.auth.AccountPrincipal;

@RestController
@RequestMapping("/api/v1/ai/conversations")
public class AgentController {
    private final ObjectProvider<AgentService> services;
    private final ObjectProvider<AgentStreams> streams;
    private final ObjectProvider<AgentActions> actions;
    public AgentController(ObjectProvider<AgentService> services, ObjectProvider<AgentStreams> streams, ObjectProvider<AgentActions> actions) { this.services = services; this.streams = streams; this.actions = actions; }
    private AgentStreams streams() {
        service(); return streams.getObject();
    }
    private AgentService service() {
        var service = services.getIfAvailable();
        if (service == null) throw new ApiFailure(503, "AI_DISABLED", "Der KI-Assistent ist nicht aktiviert.");
        return service;
    }
    private AgentExecutionContext context(Authentication authentication, HttpServletRequest request) {
        if (!(authentication.getPrincipal() instanceof AccountPrincipal principal))
            throw new ApiFailure(401, "UNAUTHENTICATED", "Bitte erneut anmelden.");
        var session = request.getSession(false);
        return new AgentExecutionContext(principal.id(), principal.sessionVersion(), () -> {
            if (session == null) return false;
            try { session.getCreationTime(); return true; } catch (IllegalStateException error) { return false; }
        });
    }
    @PostMapping
    ResponseEntity<Conversation> create(Authentication authentication, HttpServletRequest request, @Valid @RequestBody CreateConversation input) {
        return ResponseEntity.status(201).body(service().create(context(authentication, request), input.language()));
    }
    @GetMapping("/{id}")
    Conversation get(Authentication authentication, HttpServletRequest request, @PathVariable UUID id) {
        return service().get(context(authentication, request), id);
    }
    @GetMapping
    ConversationList list(Authentication authentication, HttpServletRequest request) { return service().list(context(authentication, request)); }
    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(Authentication authentication, HttpServletRequest request, @PathVariable UUID id) {
        service().delete(context(authentication, request), id); return ResponseEntity.noContent().build();
    }
    @GetMapping("/{id}/executions")
    java.util.List<ExecutionRecord> executions(Authentication authentication, HttpServletRequest request, @PathVariable UUID id) { return service().executions(context(authentication, request), id); }
    @PostMapping("/{id}/messages")
    Turn send(Authentication authentication, HttpServletRequest request, @PathVariable UUID id, @Valid @RequestBody SendMessage input) {
        return service().send(context(authentication, request), id, input);
    }
    @PostMapping(value="/{id}/messages/stream", produces="text/event-stream")
    ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.SseEmitter> stream(Authentication authentication,
            HttpServletRequest request, @PathVariable UUID id, @Valid @RequestBody SendMessage input) {
        var emitter = streams().start(context(authentication, request), id, input);
        return ResponseEntity.ok().header("X-Accel-Buffering", "no").header("Cache-Control", "no-store")
            .contentType(org.springframework.http.MediaType.parseMediaType("text/event-stream;charset=UTF-8")).body(emitter);
    }
    @PostMapping("/{id}/requests/{requestId}/cancel")
    ResponseEntity<Void> cancel(Authentication authentication, HttpServletRequest request, @PathVariable UUID id, @PathVariable UUID requestId) {
        streams().cancel(context(authentication, request), id, requestId);
        return ResponseEntity.noContent().build();
    }
    @PostMapping("/{id}/actions/{actionId}/decision")
    NavigationActions.Decision decide(Authentication authentication, HttpServletRequest request, @PathVariable UUID id, @PathVariable UUID actionId,
            @Valid @RequestBody NavigationActions.DecisionInput input) {
        service(); return actions.getObject().decide(context(authentication, request), id, actionId, input);
    }
    @PostMapping("/{id}/actions/{actionId}/result")
    NavigationActions.Action report(Authentication authentication, HttpServletRequest request, @PathVariable UUID id, @PathVariable UUID actionId,
            @Valid @RequestBody NavigationActions.ResultInput input) {
        service(); return actions.getObject().report(context(authentication, request), id, actionId, input);
    }
    @PostMapping("/{id}/creations/{actionId}/decision")
    WorkspaceMutations.Action mutate(Authentication authentication, HttpServletRequest request, @PathVariable UUID id, @PathVariable UUID actionId,
            @Valid @RequestBody WorkspaceMutations.DecisionInput input) {
        service(); return actions.getObject().mutate(context(authentication, request), id, actionId, input);
    }
}
