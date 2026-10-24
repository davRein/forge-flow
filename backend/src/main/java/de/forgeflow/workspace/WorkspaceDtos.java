package de.forgeflow.workspace;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public final class WorkspaceDtos {
    private WorkspaceDtos() {}
    public record Envelope(@Min(1) @Max(1) int version, @NotBlank @Size(max=128) String revision, @NotNull @Valid Data data) {}
    public record Data(
        @NotNull @Size(max=10000) List<@Valid Project> projects, @NotNull @Size(max=10000) List<@Valid Customer> customers,
        @NotNull @Size(max=10000) List<@Valid Task> tasks, @NotNull @Size(max=10000) List<@Valid Activity> activities,
        @NotNull @Size(max=10000) List<@Valid Epic> epics, @NotNull @Size(max=10000) List<@Valid Sprint> sprints,
        @NotNull @Size(max=10000) List<@Valid FileMetadata> files, @NotNull @Valid Wiki wiki) {
        public static Data empty() { return new Data(List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), new Wiki(List.of(), List.of())); }
    }
    public record Project(@Positive @Max(9007199254740991L) long id, @Positive long customerId, @NotBlank @Size(max=1000) String name, boolean planningCompleted, @NotBlank String deadline) {}
    public record Customer(@Positive @Max(9007199254740991L) long id, @NotBlank @Size(max=1000) String name, @NotNull @Size(max=1000) String street,
        @NotNull @Size(max=1000) String city, @NotNull @Size(max=1000) String country, @NotNull @Size(max=1000) String email,
        @Size(max=2000) String website, @NotNull @Size(max=1000) String phone, @NotNull @Size(max=1000) String industry,
        @Size(max=32) String postalCode, @Size(max=100) List<@NotNull @Valid CustomerContact> contacts, @Size(max=6000) String notes) {
        public Customer { if (postalCode == null) postalCode = ""; if (contacts != null) contacts = List.copyOf(contacts); }
        public Customer(long id, String name, String street, String city, String country, String email, String website, String phone, String industry, String postalCode) {
            this(id, name, street, city, country, email, website, phone, industry, postalCode, List.of(), "");
        }
        public Customer(long id, String name, String street, String city, String country, String email, String website, String phone, String industry) {
            this(id, name, street, city, country, email, website, phone, industry, "");
        }
    }
    public record CustomerContact(@Positive @Max(9007199254740991L) long id, @Positive long customerId,
        @NotBlank @Size(max=1000) String name, @NotNull @Size(max=200) String role,
        @NotNull @Email @Size(max=254) String email, @NotNull @Size(max=100) String phone) {}
    public record Task(@Positive @Max(9007199254740991L) long id, @Positive long projectId, @Positive Long epicId, @NotBlank @Size(max=100) String code,
        @NotBlank @Size(max=1000) String title, @Size(max=1000000) String description, @Pattern(regexp="todo|inProgress|done") @NotNull String status,
        @Pattern(regexp="low|medium|high") @NotNull String priority, @NotBlank String createdAt, @NotBlank String updatedAt) {}
    public record Activity(@Positive @Max(9007199254740991L) long id, @Positive long projectId,
        @Pattern(regexp="task_(created|updated|moved|deleted)|epic_(created|updated|deleted)|sprint_(created|updated|started|completed|deleted)|file_(added|renamed|removed)") @NotNull String type,
        @NotBlank @Size(max=4000) String message, @NotBlank String createdAt) {}
    public record Epic(@Positive @Max(9007199254740991L) long id, @Positive long projectId, @NotBlank @Size(max=1000) String title,
        @NotNull @Size(max=1000000) String description, @NotBlank String createdAt, @NotBlank String updatedAt) {}
    public record TaskSnapshot(@Positive long id, @NotBlank String code, @NotBlank String title, @NotNull @Pattern(regexp="todo|inProgress|done") String status) {}
    public record Completion(@NotBlank String completedAt, @NotNull @Size(max=10000) List<@Valid TaskSnapshot> tasks) {}
    public record Sprint(@Positive @Max(9007199254740991L) long id, @Positive long projectId, @NotBlank @Size(max=1000) String title,
        @NotNull @Size(max=1000000) String goal, @NotBlank String startDate, @NotBlank String endDate,
        @NotNull @Pattern(regexp="planned|active|completed") String status, @NotNull @Size(max=10000) List<@Positive Long> taskIds,
        @NotBlank String createdAt, @NotBlank String updatedAt, String startedAt, @Valid Completion completion) {}
    public record FileMetadata(@Positive @Max(9007199254740991L) long id, @Positive long projectId, @NotBlank @Size(max=1000) String name,
        @PositiveOrZero @Max(20971520) long size, @NotNull @Size(max=200) String mediaType, @PositiveOrZero long lastModified, @NotBlank String addedAt, @NotBlank String updatedAt) {}
    public record Wiki(@NotNull @Size(max=10000) List<@Valid Article> articles, @NotNull @Size(max=10000) List<@Valid Category> categories) {}
    public record Article(@Positive @Max(9007199254740991L) long id, @NotBlank @Size(max=1000) String title, @NotBlank @Size(max=1000000) String content,
        @Positive Long categoryId, @NotBlank String createdAt, @NotBlank String updatedAt, @Positive @Max(9007199254740991L) Long parentId) {
        public Article(long id, String title, String content, Long categoryId, String createdAt, String updatedAt) {
            this(id, title, content, categoryId, createdAt, updatedAt, null);
        }
    }
    public record Category(@Positive @Max(9007199254740991L) long id, @NotBlank @Size(max=1000) String name,
        @NotNull @Size(max=1000000) String description, @NotBlank String createdAt, @NotBlank String updatedAt) {}
    public record Settings(@Min(1) @Max(1) int version, @NotNull @Valid SettingsValues settings) {}
    public record SettingsValues(@NotNull @Pattern(regexp="dark|light") String themeMode, @NotNull @Pattern(regexp="dashboard|projects") String defaultProjectView,
        @NotNull @Pattern(regexp="low|medium|high") String defaultTaskPriority,
        @NotNull @Pattern(regexp="de|en") String language) {
        public SettingsValues {
            if (language == null) language = "de";
        }
        public SettingsValues(String themeMode, String defaultProjectView, String defaultTaskPriority) {
            this(themeMode, defaultProjectView, defaultTaskPriority, "de");
        }
    }
}
