package de.forgeflow.ai;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.read.ListAppender;
import org.slf4j.LoggerFactory;

/** Capture logging events directly, independent of Boot's console reconfiguration. */
final class AiLogCapture implements AutoCloseable {
    private final Logger root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
    private final Logger diagnostic = (Logger) LoggerFactory.getLogger(OpenAiModelGateway.class);
    private final ch.qos.logback.classic.Level previousLevel = diagnostic.getLevel();
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    AiLogCapture() { diagnostic.setLevel(ch.qos.logback.classic.Level.WARN); appender.start(); root.addAppender(appender); }
    String text() {
        return appender.list.stream().map(event -> event.getFormattedMessage()
            + (event.getThrowableProxy() == null ? "" : ThrowableProxyUtil.asString(event.getThrowableProxy())))
            .collect(java.util.stream.Collectors.joining("\n"));
    }
    @Override public void close() { root.detachAppender(appender); appender.stop(); diagnostic.setLevel(previousLevel); }
}
