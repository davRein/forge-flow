package de.forgeflow;

import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import de.forgeflow.workspace.WorkspaceDtos.*;
import de.forgeflow.workspace.WorkspaceValidation;
import static org.assertj.core.api.Assertions.*;

class DocumentationHierarchyTest {
    private static final String NOW = "2026-10-24T10:00:00Z";
    private List<Article> chain(int length) {
        return IntStream.rangeClosed(1, length).mapToObj(id -> new Article(id, "Page " + id, "Content", null, NOW, NOW, id == 1 ? null : (long) id - 1)).toList();
    }
    @Test void maximumDepthIsBoundedAndDoesNotDependOnInputOrder() {
        assertThatCode(() -> WorkspaceValidation.validatePageHierarchy(new Wiki(chain(12).reversed(), List.of()))).doesNotThrowAnyException();
        assertThatThrownBy(() -> WorkspaceValidation.validatePageHierarchy(new Wiki(chain(13), List.of()))).isInstanceOf(de.forgeflow.api.ApiFailure.class).hasMessageContaining("zwölf");
    }
    @Test void selfParentAndCrossSpaceParentsAreRejected() {
        assertThatThrownBy(() -> WorkspaceValidation.validatePageHierarchy(new Wiki(List.of(new Article(1, "Self", "Text", null, NOW, NOW, 1L)), List.of()))).isInstanceOf(de.forgeflow.api.ApiFailure.class);
        assertThatThrownBy(() -> WorkspaceValidation.validatePageHierarchy(new Wiki(List.of(new Article(1, "Child", "Text", 2L, NOW, NOW, 2L), new Article(2, "Root", "Text", 1L, NOW, NOW)), List.of()))).isInstanceOf(de.forgeflow.api.ApiFailure.class);
    }
}
