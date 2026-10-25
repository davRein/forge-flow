package de.forgeflow.business;

import java.math.*;
import java.time.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import jakarta.validation.Validator;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.time.TimeTracking;
import de.forgeflow.workspace.WorkspaceDtos;
import de.forgeflow.business.BusinessData.*;

@Component
public class BusinessRules {
    private final Validator validator; private final JsonMapper json;
    public BusinessRules(Validator validator, JsonMapper json) { this.validator = validator; this.json = json; }
    public static ApiFailure invalid(String message) { return new ApiFailure(422, "INVALID_BUSINESS_DATA", message); }
    public static void revision(String expected, BusinessData current) { if (!current.revision().equals(expected)) throw new ApiFailure(409, "VERSION_CONFLICT", "Die Business-Daten wurden inzwischen geändert. Bitte neu laden."); }
    public static long net(Line line) {
        try {
            if (line.minutes() > 0) return BigDecimal.valueOf(line.minutes()).multiply(BigDecimal.valueOf(line.unitPriceCents())).divide(BigDecimal.valueOf(60), 0, RoundingMode.HALF_UP).longValueExact();
            BigDecimal quantity = new BigDecimal(line.quantity());
            if (quantity.signum() <= 0) throw invalid("Eine Position benötigt eine positive Menge.");
            return quantity.multiply(BigDecimal.valueOf(line.unitPriceCents())).setScale(0, RoundingMode.HALF_UP).longValueExact();
        } catch (NumberFormatException | ArithmeticException error) { throw invalid("Ungültiger Positionsbetrag."); }
    }
    public static long tax(Line line) { return BigDecimal.valueOf(net(line)).multiply(BigDecimal.valueOf(line.taxBasisPoints())).divide(BigDecimal.valueOf(10000), 0, RoundingMode.HALF_UP).longValueExact(); }
    public static long[] totals(Document document) {
        long net = 0, tax = 0; try { for (var line : document.lines()) { net = Math.addExact(net, net(line)); tax = Math.addExact(tax, tax(line)); } long total = Math.addExact(net, tax); if (total > 9000000000000L) throw invalid("Der Dokumentbetrag ist zu groß."); return new long[] { net, tax, total }; }
        catch (ArithmeticException error) { throw invalid("Der Dokumentbetrag ist zu groß."); }
    }
    public BusinessData normalize(BusinessData input, BusinessData before, WorkspaceDtos.Data workspace, TimeTracking time) {
        revision(input.revision(), before);
        if (!validator.validate(input).isEmpty()) throw invalid("Bitte gültige Business-Daten angeben.");
        var budgetIds = new HashSet<Long>(); var templateIds = new HashSet<UUID>(); var documentIds = new HashSet<UUID>();
        for (var budget : input.budgets()) {
            if (!budgetIds.add(budget.projectId()) || workspace.projects().stream().noneMatch(project -> project.id() == budget.projectId()) && before.budgets().stream().noneMatch(old -> old.equals(budget))) throw invalid("Ungültiges Projektbudget.");
        }
        for (var template : input.templates()) if (!templateIds.add(template.id())) throw invalid("Doppelte Vorlagenkennung.");
        var old = new HashMap<UUID, Document>(); before.documents().forEach(document -> old.put(document.id(), document));
        var result = new ArrayList<Document>();
        for (var document : input.documents()) {
            if (!documentIds.add(document.id())) throw invalid("Doppelte Dokumentkennung.");
            try { if (LocalDate.parse(document.date()).getYear() < 1 || LocalDate.parse(document.dueDate()).isBefore(LocalDate.parse(document.date()))) throw invalid("Ungültiger Dokumentzeitraum."); }
            catch (java.time.format.DateTimeParseException error) { throw invalid("Ungültiger Dokumentzeitraum."); }
            var prior = old.get(document.id());
            if (prior != null && !prior.status().equals("draft")) {
                var permitted = prior.kind().equals("invoice") ? Set.of("paid", "cancelled") : Set.of("accepted", "rejected");
                if (!document.equals(prior.with(document.status(), prior.number(), prior.issuer(), prior.recipient())) || !document.status().equals(prior.status()) && (!prior.status().equals("issued") || !permitted.contains(document.status())))
                    throw invalid("Freigegebene Dokumente können nur ihren Status ändern.");
                result.add(document); continue;
            }
            var customer = workspace.customers().stream().filter(value -> value.id() == document.customerId()).findFirst().orElseThrow(() -> invalid("Der ausgewählte Kunde ist nicht verfügbar."));
            if (document.projectId() != null && workspace.projects().stream().noneMatch(project -> project.id() == document.projectId() && project.customerId() == document.customerId())) throw invalid("Das ausgewählte Projekt gehört nicht zu diesem Kunden.");
            if (!Set.of("draft", "issued").contains(document.status())) throw invalid("Ungültiger Dokumentstatus.");
            totals(document);
            var usedIds = new HashSet<UUID>();
            for (var id : document.timeEntryIds()) {
                if (!usedIds.add(id) || time.entries().stream().noneMatch(entry -> entry.id().equals(id) && entry.billable() && Objects.equals(entry.customerId(), document.customerId()))) throw invalid("Eine ausgewählte Zeitbuchung ist nicht abrechenbar.");
                if (document.kind().equals("invoice") && document.status().equals("issued") && before.documents().stream().anyMatch(value -> !value.id().equals(document.id()) && value.kind().equals("invoice") && Set.of("issued", "paid").contains(value.status()) && value.timeEntryIds().contains(id))) throw invalid("Eine Zeitbuchung wurde bereits abgerechnet.");
                if (document.kind().equals("invoice") && document.status().equals("issued") && result.stream().anyMatch(value -> value.kind().equals("invoice") && Set.of("issued", "paid").contains(value.status()) && value.timeEntryIds().contains(id))) throw invalid("Eine Zeitbuchung wurde bereits abgerechnet.");
            }
            String number = "", issuer = document.issuer();
            String recipient = String.join("\n", customer.name(), customer.street(), String.join(" ", customer.postalCode(), customer.city()).strip(), customer.country());
            if (document.status().equals("issued")) {
                if (input.profile().company().isBlank() || input.profile().address().isBlank() || document.lines().isEmpty()) throw invalid("Für die Freigabe fehlen Absender oder Positionen.");
                String prefix = (document.kind().equals("invoice") ? "INV-" : "OFF-") + LocalDate.parse(document.date()).getYear() + "-";
                int max = 0;
                for (var candidate : before.documents()) if (candidate.number().startsWith(prefix)) try { max = Math.max(max, Integer.parseInt(candidate.number().substring(prefix.length()))); } catch (NumberFormatException ignored) { }
                for (var candidate : result) if (candidate.number().startsWith(prefix)) max = Math.max(max, Integer.parseInt(candidate.number().substring(prefix.length())));
                number = prefix + String.format(Locale.ROOT, "%05d", max + 1);
                var profile = input.profile(); issuer = String.join("\n", profile.company(), profile.address(), profile.email(), profile.taxId(), profile.bank());
            }
            result.add(document.with(document.status(), number, issuer, recipient));
        }
        for (var document : before.documents()) if (!document.status().equals("draft") && !documentIds.contains(document.id())) throw invalid("Freigegebene Dokumente dürfen nicht gelöscht werden.");
        var value = new BusinessData(1, before.revision(), input.profile(), List.copyOf(input.budgets()), List.copyOf(input.templates()), List.copyOf(result), before.timer());
        if (json.writeValueAsString(value).getBytes(StandardCharsets.UTF_8).length > 5 * 1024 * 1024) throw new ApiFailure(413, "BUSINESS_LIMIT", "Business-Daten dürfen höchstens 5 MiB umfassen.");
        return value;
    }
}
