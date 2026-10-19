package de.forgeflow.api;

import java.util.Map;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import tools.jackson.databind.json.JsonMapper;

@RestControllerAdvice
public class ApiErrors {
    public static Map<String, Object> payload(String code, String message) { return Map.of("error", Map.of("code", code, "message", message)); }
    public static void write(HttpServletResponse response, int status, String code, String message) throws java.io.IOException {
        response.setStatus(status); response.setContentType("application/json"); response.setCharacterEncoding("UTF-8");
        response.getWriter().write(JsonMapper.builder().build().writeValueAsString(payload(code, message)));
    }
    @ExceptionHandler(ApiFailure.class)
    ResponseEntity<?> failure(ApiFailure error) { return ResponseEntity.status(error.status).body(payload(error.code, error.getMessage())); }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    ResponseEntity<?> invalid(Exception error) { return ResponseEntity.badRequest().body(payload("INVALID_INPUT", "Bitte die Eingaben prüfen.")); }
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<?> tooLarge(Exception error) { return ResponseEntity.status(413).body(payload("PAYLOAD_TOO_LARGE", "Die Anfrage ist zu groß.")); }
}
