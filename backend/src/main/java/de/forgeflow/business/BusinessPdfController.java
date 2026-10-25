package de.forgeflow.business;

import java.time.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.time.TimeTrackingStorage;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.workspace.WorkspaceStorage;

@RestController @RequestMapping("/api/v1/me/business")
public class BusinessPdfController {
    private final BusinessStorage business; private final TimeTrackingStorage time; private final WorkspaceStorage workspace; private final PdfReports pdf;
    public BusinessPdfController(BusinessStorage business, TimeTrackingStorage time, WorkspaceStorage workspace, PdfReports pdf) { this.business = business; this.time = time; this.workspace = workspace; this.pdf = pdf; }
    public static ResponseEntity<byte[]> file(byte[] bytes, String name) { return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).header("Content-Disposition", ContentDisposition.attachment().filename(name, java.nio.charset.StandardCharsets.UTF_8).build().toString()).body(bytes); }
    @GetMapping("/documents/{id}/pdf") public ResponseEntity<byte[]> document(Authentication auth, @PathVariable UUID id, @RequestParam(defaultValue="en") String language) {
        var value = business.load(auth.getName()).documents().stream().filter(document -> document.id().equals(id)).findFirst().orElseThrow(() -> new ApiFailure(404, "NOT_FOUND", "Dokument nicht gefunden."));
        return file(pdf.document(value, language), (value.number().isBlank() ? "draft-" + value.id() : value.number()) + ".pdf");
    }
    @GetMapping("/timesheet/pdf") public ResponseEntity<byte[]> timesheet(Authentication auth, @RequestParam String month, @RequestParam(required=false) Long customerId,
            @RequestParam(required=false) Long projectId, @RequestParam(defaultValue="true") boolean comments, @RequestParam(defaultValue="en") String language) {
        try { YearMonth.parse(month); } catch (DateTimeException error) { throw BusinessRules.invalid("Ungültiger Monat."); }
        String name = customerId == null ? business.load(auth.getName()).profile().company() : workspace.load(auth.getName()).data().customers().stream().filter(value -> value.id() == customerId).map(value -> value.name()).findFirst().orElseGet(() -> time.load(auth.getName()).entries().stream().filter(value -> Objects.equals(value.customerId(), customerId)).map(value -> value.customerName()).findFirst().orElse(""));
        var entries = time.load(auth.getName()).entries().stream().filter(entry -> entry.date().startsWith(month + "-") && (customerId == null || Objects.equals(entry.customerId(), customerId)) && (projectId == null || Objects.equals(entry.projectId(), projectId))).toList();
        return file(pdf.timesheet(entries, name, month, comments, language), "timesheet-" + month + ".pdf");
    }
}
