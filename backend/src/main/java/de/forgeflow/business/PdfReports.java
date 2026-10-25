package de.forgeflow.business;

import java.io.*;
import java.text.NumberFormat;
import java.util.*;
import java.awt.Color;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.stereotype.Component;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.time.TimeTracking;

@Component
public class PdfReports {
    public byte[] document(BusinessData.Document value, String language) {
        boolean en = "en".equals(language);
        try (var pdf = new Writer()) {
            pdf.title(value.kind().equals("invoice") ? en ? "Invoice" : "Rechnung" : en ? "Quotation" : "Angebot", value.number().isEmpty() ? en ? "DRAFT" : "ENTWURF" : value.number());
            pdf.text(value.title(), 14, true); pdf.text((en ? "Date: " : "Datum: ") + value.date() + "   |   " + (en ? "Due: " : "Fällig: ") + value.dueDate(), 10, false);
            pdf.section(en ? "From" : "Absender"); pdf.text(value.issuer().isBlank() ? "ForgeFlow" : value.issuer(), 10, false);
            pdf.section(en ? "To" : "Empfänger"); pdf.text(value.recipient(), 10, false);
            pdf.section(en ? "Services" : "Leistungen");
            var money = NumberFormat.getCurrencyInstance(en ? Locale.UK : Locale.GERMANY); money.setCurrency(Currency.getInstance(value.currency()));
            for (int index = 0; index < value.lines().size(); index++) {
                pdf.reserve(75);
                var line = value.lines().get(index); pdf.text((index + 1) + ". " + line.description(), 11, true);
                String quantity = line.minutes() > 0 ? line.minutes() / 60 + "h " + line.minutes() % 60 + "m" : line.quantity();
                pdf.text(quantity + " x " + money.format(line.unitPriceCents() / 100.0) + "   |   " + (en ? "VAT " : "USt. ") + line.taxBasisPoints() / 100.0 + "%   |   " + money.format(BusinessRules.net(line) / 100.0), 10, false); pdf.gap(8);
            }
            var totals = BusinessRules.totals(value); pdf.reserve(110); pdf.section(en ? "Total" : "Gesamtbetrag");
            pdf.text((en ? "Net: " : "Netto: ") + money.format(totals[0] / 100.0), 11, false);
            pdf.text((en ? "Tax: " : "Steuer: ") + money.format(totals[1] / 100.0), 11, false);
            pdf.text((en ? "Total: " : "Gesamt: ") + money.format(totals[2] / 100.0), 15, true);
            if (!value.notes().isBlank()) { pdf.section(en ? "Notes" : "Hinweise"); pdf.text(value.notes(), 10, false); }
            pdf.text((en ? "Status: " : "Status: ") + value.status(), 9, false); return pdf.finish();
        } catch (IOException error) { throw new ApiFailure(503, "PDF_UNAVAILABLE", "Das PDF konnte nicht erzeugt werden."); }
    }
    public byte[] timesheet(List<TimeTracking.Entry> entries, String name, String month, boolean comments, String language) {
        boolean en = "en".equals(language);
        try (var pdf = new Writer()) {
            pdf.title(en ? "Timesheet" : "Leistungsnachweis", month); pdf.text(name, 14, true);
            long minutes = 0, billable = 0;
            for (var entry : entries.stream().sorted(Comparator.comparing(TimeTracking.Entry::date).thenComparingInt(TimeTracking.Entry::startMinute)).toList()) {
                pdf.reserve(105);
                minutes += entry.minutes(); if (entry.billable()) billable += entry.minutes();
                pdf.section(entry.date() + "  " + clock(entry.startMinute()) + "-" + clock(entry.startMinute() + entry.minutes() + entry.breakMinutes()));
                pdf.text((entry.projectName().isBlank() ? en ? "No project" : "Ohne Projekt" : entry.projectName()) + "  |  " + entry.minutes() / 60 + "h " + entry.minutes() % 60 + "m" + "  |  " + (entry.billable() ? en ? "Billable" : "Abrechenbar" : en ? "Non-billable" : "Nicht abrechenbar"), 10, true);
                if (entry.breakMinutes() > 0) pdf.text((en ? "Break: " : "Pause: ") + entry.breakMinutes() + " min", 10, false);
                if (comments && !entry.comment().isBlank()) pdf.text(entry.comment(), 10, false);
            }
            pdf.reserve(110); pdf.section(en ? "Summary" : "Zusammenfassung");
            pdf.text((en ? "Working time: " : "Arbeitszeit: ") + minutes / 60 + "h " + minutes % 60 + "m", 14, true);
            pdf.text((en ? "Billable: " : "Abrechenbar: ") + billable / 60 + "h " + billable % 60 + "m", 11, false); return pdf.finish();
        } catch (IOException error) { throw new ApiFailure(503, "PDF_UNAVAILABLE", "Das PDF konnte nicht erzeugt werden."); }
    }
    private static String clock(int minute) { return String.format(Locale.ROOT, "%02d:%02d", minute / 60, minute % 60); }
    private static final class Writer implements AutoCloseable {
        private final PDDocument document = new PDDocument(); private final PDType0Font font; private PDPageContentStream stream; private float y; private int page;
        Writer() throws IOException {
            var resource = PDType0Font.class.getResourceAsStream("/org/apache/pdfbox/resources/ttf/LiberationSans-Regular.ttf");
            if (resource == null) throw new IOException("Embedded font is unavailable");
            font = PDType0Font.load(document, resource, true); newPage();
        }
        private void newPage() throws IOException {
            if (stream != null) stream.close(); var sheet = new PDPage(PDRectangle.A4); document.addPage(sheet); page++;
            stream = new PDPageContentStream(document, sheet); y = 782;
            draw("ForgeFlow", 48, 806, 11, new Color(36, 93, 102)); draw(Integer.toString(page), 535, 28, 9, Color.GRAY);
            stream.setStrokingColor(new Color(211, 222, 226)); stream.moveTo(48, 792); stream.lineTo(547, 792); stream.stroke();
        }
        private String supported(String value) {
            var result = new StringBuilder(); value.codePoints().forEach(code -> { String character = new String(Character.toChars(code)); try { font.encode(character); result.append(character); } catch (IOException | IllegalArgumentException error) { result.append('?'); } }); return result.toString();
        }
        private void draw(String value, float x, float lineY, int size, Color color) throws IOException { stream.beginText(); stream.setFont(font, size); stream.setNonStrokingColor(color); stream.newLineAtOffset(x, lineY); stream.showText(value); stream.endText(); }
        void title(String title, String subtitle) throws IOException { gap(20); text(title, 25, true); text(subtitle, 11, false); gap(12); }
        void reserve(float height) throws IOException { if (y - height < 55) newPage(); }
        void section(String title) throws IOException { reserve(50); gap(14); text(title, 12, true); gap(4); }
        void gap(float amount) throws IOException { y -= amount; if (y < 65) newPage(); }
        void text(String text, int size, boolean heading) throws IOException {
            for (var paragraph : text.replace("\r", "").split("\n", -1)) {
                String remaining = supported(paragraph.replace('\t', ' '));
                if (remaining.isEmpty()) { gap(size + 4); continue; }
                while (!remaining.isEmpty()) {
                    int end = 0; float width = 0;
                    while (end < remaining.length()) {
                        int length = Character.charCount(remaining.codePointAt(end));
                        float next = font.getStringWidth(remaining.substring(end, end + length)) / 1000 * size;
                        if (width + next > 499 && end > 0) break;
                        width += next; end += length;
                    }
                    if (end < remaining.length()) { int space = remaining.lastIndexOf(' ', end); if (space > end / 2) end = space; }
                    if (y - size - 5 < 55) newPage(); draw(remaining.substring(0, end), 48, y, size, heading ? new Color(30, 55, 66) : new Color(60, 68, 77)); gap(size + 5); remaining = remaining.substring(end).stripLeading();
                }
            }
        }
        byte[] finish() throws IOException { stream.close(); stream = null; var output = new ByteArrayOutputStream(); document.save(output); return output.toByteArray(); }
        public void close() throws IOException { if (stream != null) stream.close(); document.close(); }
    }
}
