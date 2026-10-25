package de.forgeflow;

import java.util.List;
import de.forgeflow.workspace.RecentActivity;
import de.forgeflow.workspace.WorkspaceDtos.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class RecentActivityTest {
    private Data fixture(String name) {
        var empty = Data.empty();
        return new Data(List.of(new Project(1, 1, name, false, "2026-12-31")),
            List.of(new Customer(1, "Customer", "", "", "", "", "", "", "")), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki());
    }
    @Test void recordsCreationUpdatesAndProjectChildChangesButIgnoresNoOps() {
        var data = fixture("Project"); var history = RecentActivity.workspace(List.of(), Data.empty(), data);
        assertThat(history).hasSize(2); assertThat(history.getFirst().kind()).isEqualTo("project"); assertThat(history.getFirst().action()).isEqualTo("created");
        assertThat(RecentActivity.workspace(history, data, data)).isEqualTo(history);
        var task = new Task(1, 1, null, "FF-1", "Task", "private-task-content", "todo", "medium", "2026-10-25T00:00:00Z", "2026-10-25T00:00:00Z");
        var changed = new Data(data.projects(), data.customers(), List.of(task), data.activities(), data.epics(), data.sprints(), data.files(), data.wiki());
        var saved = RecentActivity.workspace(history, data, changed);
        assertThat(saved.getFirst().action()).isEqualTo("updated"); assertThat(saved.getFirst().entityId()).isEqualTo(1); assertThat(saved.toString()).doesNotContain("private-task-content");
    }
    @Test void retainsFiveNewestEventsAndRemovesTargetsThatHaveBeenDeleted() {
        var before = Data.empty(); List<RecentActivity.Entry> history = List.of();
        for (int index = 1; index <= 9; index++) { var next = fixture("Project " + index); history = RecentActivity.workspace(history, before, next); before = next; }
        assertThat(history).hasSize(5); assertThat(history.getFirst().name()).isEqualTo("Project 9"); assertThat(history.getLast().name()).isEqualTo("Project 5");
        assertThat(RecentActivity.workspace(history, before, Data.empty())).isEmpty();
    }
}
